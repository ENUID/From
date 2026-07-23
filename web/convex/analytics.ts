import { query } from "./_generated/server";
import { v } from "convex/values";
import { verifyAdminSecret } from "./lib/adminAuth";

// ────────────────────────────────────────────────────────────────────────────
// Admin analytics — read-only aggregation over real usage, surfaced through the
// /admin/analytics dashboard (auth: ADMIN_SECRET, same operator gate as the
// community manager). Every function here is adminSecret-gated and returns a
// null/empty shape on a bad secret rather than throwing, so a wrong password
// never leaks whether data exists.
//
// IMPORTANT for debugging an "empty dashboard": ADMIN_SECRET must be set in the
// CONVEX deployment's own env (dashboard.convex.dev → Settings → Environment
// Variables), matching the Vercel value. The Next.js route checks the Vercel
// copy (so login works), but these functions check the Convex copy — if it's
// unset/mismatched, verifyAdminSecret fails and everything returns empty even
// though login succeeded. adminOverview returning null while the route reports
// authed=true is exactly that case; the dashboard calls it out.
//
// The canonical "a search happened" record is a user_events row with
// event:"search" (written for BOTH anonymous and signed-in shoppers from
// DiscernPage — see api.users.trackEvent). Signed-in rows carry a userId;
// anonymous rows don't. Impressions ("impression") and product opens
// ("product_view") ride the same store. That's what powers volume, the
// engagement funnel, top queries, and the per-user leaderboard.
// ────────────────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
// Per-query row-read caps. Kept deliberately modest: this dashboard has ~7
// queries and reloads all of them on every window toggle, so a 20k cap could
// read hundreds of thousands of (large, impression) rows per load — the single
// biggest Database-I/O consumer on the Convex free tier, which is what pushes
// the project toward a paid upgrade. 3k most-recent rows keep every aggregate
// (funnel, top searches/products/users, charts, activity feed) representative
// for an early-access catalog while cutting read I/O by ~85%. Raise these once
// on a plan that can afford the bandwidth.
const EVENT_SCAN_CAP = 3000;
const USER_SCAN_CAP = 3000;
const SAVE_SCAN_CAP = 3000;
const FLAG_SCAN_CAP = 3000;

function normQuery(s: string): string {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

function topEntries(counts: Map<string, number>, limit: number): Array<{ label: string; count: number }> {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

/** Headline totals + engagement funnel + user breakdowns over a window. */
export const adminOverview = query({
  args: { adminSecret: v.string(), windowMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return null;
    const since = Date.now() - (args.windowMs ?? 7 * DAY);

    const [searchEvents, aiEvents, impressionEvents, viewEvents] = await Promise.all([
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "search").gte("createdAt", since)).order("desc").take(EVENT_SCAN_CAP),
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "ai_usage").gte("createdAt", since)).order("desc").take(EVENT_SCAN_CAP),
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "impression").gte("createdAt", since)).order("desc").take(EVENT_SCAN_CAP),
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "product_view").gte("createdAt", since)).order("desc").take(EVENT_SCAN_CAP),
    ]);

    let anonSearches = 0;
    const searcherIds = new Set<string>();
    for (const e of searchEvents) {
      if (e.userId) searcherIds.add(String(e.userId));
      else anonSearches++;
    }

    // Impressions = individual products shown (sum of each event's array).
    let impressions = 0;
    for (const e of impressionEvents) {
      const p = (e.properties ?? {}) as any;
      impressions += Array.isArray(p.products) ? p.products.length : 0;
    }
    const views = viewEvents.length;

    // Saves + flags in window (no time index on these tables → capped scan).
    const savesRows = await ctx.db.query("saved_products").order("desc").take(SAVE_SCAN_CAP);
    let saves = 0;
    for (const s of savesRows) if (typeof s.savedAt === "number" && s.savedAt >= since) saves++;

    const flagRows = await ctx.db.query("quality_signals").order("desc").take(FLAG_SCAN_CAP);
    let flags = 0;
    for (const f of flagRows) if (f.signal === "bad_match" && typeof f.createdAt === "number" && f.createdAt >= since) flags++;

    // Users: total / new / active, plus country + device breakdown of the base.
    const users = await ctx.db.query("users").take(USER_SCAN_CAP);
    let newUsers = 0;
    let activeUsers = 0;
    const byCountry = new Map<string, number>();
    const byDevice = new Map<string, number>();
    for (const u of users) {
      if (typeof u.createdAt === "number" && u.createdAt >= since) newUsers++;
      if (typeof (u as any).lastSeenAt === "number" && (u as any).lastSeenAt >= since) activeUsers++;
      const c = (u as any).country;
      if (c) byCountry.set(String(c), (byCountry.get(String(c)) ?? 0) + 1);
      const d = (u as any).deviceType;
      if (d) byDevice.set(String(d), (byDevice.get(String(d)) ?? 0) + 1);
    }

    const rate = (n: number) => (impressions > 0 ? Math.round((n / impressions) * 1000) / 10 : null); // %

    return {
      windowMs: args.windowMs ?? 7 * DAY,
      searches: {
        total: searchEvents.length,
        signedIn: searchEvents.length - anonSearches,
        anonymous: anonSearches,
        distinctSearchers: searcherIds.size,
        capped: searchEvents.length >= EVENT_SCAN_CAP,
      },
      ai: { requests: aiEvents.length, capped: aiEvents.length >= EVENT_SCAN_CAP },
      users: { total: users.length, new: newUsers, active: activeUsers, capped: users.length >= USER_SCAN_CAP },
      funnel: { impressions, views, saves, flags },
      rates: { viewRate: rate(views), saveRate: rate(saves), flagRate: rate(flags) },
      byCountry: topEntries(byCountry, 8),
      byDevice: topEntries(byDevice, 6),
    };
  },
});

/** Time series over the window, bucketed. Powers the dashboard's line chart. */
export const adminTimeSeries = query({
  args: { adminSecret: v.string(), windowMs: v.optional(v.number()), buckets: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return null;
    const windowMs = args.windowMs ?? 7 * DAY;
    const buckets = Math.min(Math.max(args.buckets ?? 14, 2), 60);
    const now = Date.now();
    const since = now - windowMs;
    const bucketMs = windowMs / buckets;

    const [searchEvents, viewEvents] = await Promise.all([
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "search").gte("createdAt", since)).order("desc").take(EVENT_SCAN_CAP),
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "product_view").gte("createdAt", since)).order("desc").take(EVENT_SCAN_CAP),
    ]);

    const searches = new Array(buckets).fill(0);
    const views = new Array(buckets).fill(0);
    const idx = (t: number) => Math.min(buckets - 1, Math.max(0, Math.floor((t - since) / bucketMs)));
    for (const e of searchEvents) searches[idx(e.createdAt)]++;
    for (const e of viewEvents) views[idx(e.createdAt)]++;

    const points = [];
    for (let i = 0; i < buckets; i++) {
      points.push({ t0: Math.round(since + i * bucketMs), searches: searches[i], views: views[i] });
    }
    const capped = searchEvents.length >= EVENT_SCAN_CAP || viewEvents.length >= EVENT_SCAN_CAP;
    return { since, now, bucketMs, points, capped };
  },
});

/** Most-searched queries in the window, with reach and result quality. */
export const adminTopSearches = query({
  args: { adminSecret: v.string(), windowMs: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return [];
    const since = Date.now() - (args.windowMs ?? 7 * DAY);
    const limit = Math.min(Math.max(args.limit ?? 40, 1), 200);

    const events = await ctx.db
      .query("user_events")
      .withIndex("by_event_created", (q) => q.eq("event", "search").gte("createdAt", since))
      .take(EVENT_SCAN_CAP);

    const map = new Map<string, { query: string; count: number; searchers: Set<string>; resultSum: number; resultN: number; zero: number; lastAt: number }>();
    for (const e of events) {
      const p = (e.properties ?? {}) as Record<string, any>;
      const raw = String(p.query ?? "");
      const k = normQuery(raw);
      if (!k) continue;
      let row = map.get(k);
      if (!row) { row = { query: raw.slice(0, 80), count: 0, searchers: new Set(), resultSum: 0, resultN: 0, zero: 0, lastAt: 0 }; map.set(k, row); }
      row.count++;
      if (e.userId) row.searchers.add(String(e.userId));
      const rc = Number(p.resultCount);
      if (Number.isFinite(rc)) { row.resultSum += rc; row.resultN++; if (rc === 0) row.zero++; }
      if (e.createdAt > row.lastAt) row.lastAt = e.createdAt;
    }

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((r) => ({
        query: r.query,
        count: r.count,
        searchers: r.searchers.size,
        avgResults: r.resultN > 0 ? Math.round((r.resultSum / r.resultN) * 10) / 10 : null,
        zeroResults: r.zero,
        lastAt: r.lastAt,
      }));
  },
});

/** Most-active signed-in shoppers in the window. */
export const adminTopUsers = query({
  args: { adminSecret: v.string(), windowMs: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return [];
    const since = Date.now() - (args.windowMs ?? 7 * DAY);
    const limit = Math.min(Math.max(args.limit ?? 30, 1), 200);

    const events = await ctx.db
      .query("user_events")
      .withIndex("by_event_created", (q) => q.eq("event", "search").gte("createdAt", since))
      .take(EVENT_SCAN_CAP);

    const searchByUser = new Map<string, number>();
    for (const e of events) {
      if (!e.userId) continue;
      const id = String(e.userId);
      searchByUser.set(id, (searchByUser.get(id) ?? 0) + 1);
    }

    const saves = await ctx.db.query("saved_products").order("desc").take(SAVE_SCAN_CAP);
    const savesByUser = new Map<string, number>();
    for (const s of saves) {
      if (typeof s.savedAt === "number" && s.savedAt < since) continue;
      const id = String(s.userId);
      savesByUser.set(id, (savesByUser.get(id) ?? 0) + 1);
    }

    const ids = new Set<string>(Array.from(searchByUser.keys()).concat(Array.from(savesByUser.keys())));
    const rows: Array<{ email: string; name: string | null; searches: number; saves: number; lastSeenAt: number | null; country: string | null; deviceType: string | null }> = [];
    for (const id of Array.from(ids)) {
      const u = await ctx.db.get(id as any);
      if (!u) continue;
      rows.push({
        email: (u as any).email ?? "(unknown)",
        name: (u as any).name ?? null,
        searches: searchByUser.get(id) ?? 0,
        saves: savesByUser.get(id) ?? 0,
        lastSeenAt: typeof (u as any).lastSeenAt === "number" ? (u as any).lastSeenAt : null,
        country: (u as any).country ?? null,
        deviceType: (u as any).deviceType ?? null,
      });
    }
    return rows.sort((a, b) => b.searches - a.searches || b.saves - a.saves).slice(0, limit);
  },
});

/** Unified activity timeline — every recent action (search, product open, save,
 * flag) merged and sorted newest-first, each carrying the EXACT text involved
 * (the query typed, the product opened/saved/flagged) and the shopper's email
 * when known. This is the "what did every single person actually do" feed. */
export const adminActivityFeed = query({
  args: { adminSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return [];
    const limit = Math.min(Math.max(args.limit ?? 80, 1), 300);
    const per = Math.min(limit + 20, 150);

    const [searches, opens] = await Promise.all([
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "search")).order("desc").take(per),
      ctx.db.query("user_events").withIndex("by_event_created", (q) => q.eq("event", "product_view")).order("desc").take(per),
    ]);
    const saves = await ctx.db.query("saved_products").order("desc").take(per);
    const flags = await ctx.db.query("quality_signals").order("desc").take(per);

    type Row = { kind: string; text: string; meta: string | null; at: number; country: string | null; userId: string | null; email?: string | null };
    const rows: Row[] = [];
    for (const e of searches) {
      const p = (e.properties ?? {}) as any;
      const rc = Number(p.resultCount);
      // Prefer the verbatim message (`raw`) — the exact words the shopper typed —
      // falling back to the AI's search concept for older rows without it.
      const verbatim = String(p.raw ?? p.query ?? "").slice(0, 200);
      const concept = String(p.query ?? "");
      // If the concept differs from what they typed, show it as context.
      const meta = [
        Number.isFinite(rc) ? `${rc} result${rc === 1 ? "" : "s"}` : null,
        concept && concept.toLowerCase() !== verbatim.toLowerCase() ? `→ ${concept}` : null,
      ].filter(Boolean).join("  ") || null;
      rows.push({ kind: "search", text: verbatim, meta, at: e.createdAt, country: e.country ?? null, userId: e.userId ? String(e.userId) : null });
    }
    for (const e of opens) {
      const p = (e.properties ?? {}) as any;
      rows.push({ kind: "open", text: String(p.title ?? "").slice(0, 140), meta: p.vendor ? String(p.vendor) : null, at: e.createdAt, country: e.country ?? null, userId: e.userId ? String(e.userId) : null });
    }
    for (const s of saves) {
      rows.push({ kind: "save", text: String((s.product as any)?.title ?? "").slice(0, 140), meta: (s.product as any)?.vendor ? String((s.product as any).vendor) : null, at: s.savedAt, country: null, userId: String(s.userId) });
    }
    for (const f of flags) {
      if (f.signal !== "bad_match") continue;
      rows.push({ kind: "flag", text: String(f.query ?? f.productTitle ?? "").slice(0, 140), meta: f.productTitle ? String(f.productTitle).slice(0, 80) : null, at: f.createdAt, country: null, userId: f.userId ? String(f.userId) : null });
    }

    rows.sort((a, b) => b.at - a.at);
    const top = rows.slice(0, limit);

    const cache = new Map<string, string | null>();
    for (const r of top) {
      if (!r.userId) { r.email = null; continue; }
      if (cache.has(r.userId)) { r.email = cache.get(r.userId)!; continue; }
      const u = await ctx.db.get(r.userId as any);
      const em = (u as any)?.email ?? null;
      cache.set(r.userId, em);
      r.email = em;
    }
    return top.map((r) => ({ kind: r.kind, text: r.text, meta: r.meta, at: r.at, country: r.country, email: r.email ?? null }));
  },
});

/** The products earning the most attention in the window — most-opened and
 * most-saved, with real titles/brands. "What are people actually drawn to." */
export const adminTopProducts = query({
  args: { adminSecret: v.string(), windowMs: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return { opened: [], saved: [] };
    const since = Date.now() - (args.windowMs ?? 7 * DAY);
    const limit = Math.min(Math.max(args.limit ?? 10, 1), 50);

    const opens = await ctx.db
      .query("user_events")
      .withIndex("by_event_created", (q) => q.eq("event", "product_view").gte("createdAt", since))
      .take(EVENT_SCAN_CAP);
    const openMap = new Map<string, { title: string; vendor: string | null; count: number }>();
    for (const e of opens) {
      const p = (e.properties ?? {}) as any;
      const id = String(p.productId ?? "");
      if (!id) continue;
      let r = openMap.get(id);
      if (!r) { r = { title: String(p.title ?? "").slice(0, 90), vendor: p.vendor ? String(p.vendor) : null, count: 0 }; openMap.set(id, r); }
      r.count++;
    }

    const saves = await ctx.db.query("saved_products").order("desc").take(SAVE_SCAN_CAP);
    const saveMap = new Map<string, { title: string; vendor: string | null; count: number }>();
    for (const s of saves) {
      if (typeof s.savedAt === "number" && s.savedAt < since) continue;
      const id = String((s.product as any)?.id ?? "");
      if (!id) continue;
      let r = saveMap.get(id);
      if (!r) { r = { title: String((s.product as any)?.title ?? "").slice(0, 90), vendor: (s.product as any)?.vendor ? String((s.product as any).vendor) : null, count: 0 }; saveMap.set(id, r); }
      r.count++;
    }

    const top = (m: Map<string, { title: string; vendor: string | null; count: number }>) =>
      Array.from(m.values()).sort((a, b) => b.count - a.count).slice(0, limit);
    return { opened: top(openMap), saved: top(saveMap) };
  },
});

/** The most recent searches, newest first, with the shopper's email when known. */
export const adminRecentSearches = query({
  args: { adminSecret: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return [];
    const limit = Math.min(Math.max(args.limit ?? 60, 1), 200);

    const events = await ctx.db
      .query("user_events")
      .withIndex("by_event_created", (q) => q.eq("event", "search"))
      .order("desc")
      .take(limit);

    const emailCache = new Map<string, string>();
    const out: Array<{ query: string; email: string | null; resultCount: number | null; at: number; country: string | null }> = [];
    for (const e of events) {
      const p = (e.properties ?? {}) as Record<string, any>;
      let email: string | null = null;
      if (e.userId) {
        const id = String(e.userId);
        if (emailCache.has(id)) email = emailCache.get(id)!;
        else {
          const u = await ctx.db.get(e.userId as any);
          email = (u as any)?.email ?? null;
          if (email) emailCache.set(id, email);
        }
      }
      const rc = Number(p.resultCount);
      out.push({
        query: String(p.query ?? "").slice(0, 120),
        email,
        resultCount: Number.isFinite(rc) ? rc : null,
        at: e.createdAt,
        country: e.country ?? null,
      });
    }
    return out;
  },
});
