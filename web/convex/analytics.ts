import { query } from "./_generated/server";
import { v } from "convex/values";
import { verifyAdminSecret } from "./lib/adminAuth";

// ────────────────────────────────────────────────────────────────────────────
// Admin analytics — read-only aggregation over real usage, surfaced through the
// /admin/analytics dashboard (auth: ADMIN_SECRET, same operator gate as the
// community manager). Every function here is adminSecret-gated and returns an
// empty/zeroed shape on a bad secret rather than throwing, so a wrong password
// never leaks whether data exists.
//
// The canonical "a search happened" record is a user_events row with
// event:"search" (written for BOTH anonymous and signed-in shoppers from
// DiscernPage — see api.users.trackEvent). Signed-in rows carry a userId;
// anonymous rows don't. That single stream is what powers volume, top queries,
// and the per-user leaderboard, so anonymous traffic is counted too — not just
// the signed-in search_history table.
// ────────────────────────────────────────────────────────────────────────────

const DAY = 24 * 60 * 60 * 1000;
// Generous scan ceilings so a single dashboard load stays bounded even as the
// tables grow. If a window ever exceeds these we under-count rather than time
// out — the dashboard notes when a cap was hit.
const EVENT_SCAN_CAP = 20000;
const USER_SCAN_CAP = 20000;
const SAVE_SCAN_CAP = 20000;

function normQuery(s: string): string {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Headline totals over a trailing window (default 7 days). */
export const adminOverview = query({
  args: { adminSecret: v.string(), windowMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    if (!verifyAdminSecret(args.adminSecret)) return null;
    const since = Date.now() - (args.windowMs ?? 7 * DAY);

    const searchEvents = await ctx.db
      .query("user_events")
      .withIndex("by_event_created", (q) => q.eq("event", "search").gte("createdAt", since))
      .take(EVENT_SCAN_CAP);

    const aiEvents = await ctx.db
      .query("user_events")
      .withIndex("by_event_created", (q) => q.eq("event", "ai_usage").gte("createdAt", since))
      .take(EVENT_SCAN_CAP);

    let anonSearches = 0;
    const searcherIds = new Set<string>();
    for (const e of searchEvents) {
      if (e.userId) searcherIds.add(String(e.userId));
      else anonSearches++;
    }

    // Users are far fewer than events; a capped full scan is fine here and
    // gives us total / new-in-window / active-in-window in one pass.
    const users = await ctx.db.query("users").take(USER_SCAN_CAP);
    let newUsers = 0;
    let activeUsers = 0;
    for (const u of users) {
      if (typeof u.createdAt === "number" && u.createdAt >= since) newUsers++;
      if (typeof (u as any).lastSeenAt === "number" && (u as any).lastSeenAt >= since) activeUsers++;
    }

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
      users: {
        total: users.length,
        new: newUsers,
        active: activeUsers,
        capped: users.length >= USER_SCAN_CAP,
      },
    };
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

    const map = new Map<
      string,
      { query: string; count: number; searchers: Set<string>; resultSum: number; resultN: number; zero: number; lastAt: number }
    >();
    for (const e of events) {
      const p = (e.properties ?? {}) as Record<string, any>;
      const raw = String(p.query ?? "");
      const key = normQuery(raw);
      if (!key) continue;
      let row = map.get(key);
      if (!row) {
        row = { query: raw.slice(0, 80), count: 0, searchers: new Set(), resultSum: 0, resultN: 0, zero: 0, lastAt: 0 };
        map.set(key, row);
      }
      row.count++;
      if (e.userId) row.searchers.add(String(e.userId));
      const rc = Number(p.resultCount);
      if (Number.isFinite(rc)) {
        row.resultSum += rc;
        row.resultN++;
        if (rc === 0) row.zero++;
      }
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

/** Most-active signed-in shoppers in the window (anonymous traffic can't be
 * attributed to a person, by design — it shows only in the overview totals). */
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

    // Saves in the window, grouped by user (bounded scan).
    const saves = await ctx.db.query("saved_products").order("desc").take(SAVE_SCAN_CAP);
    const savesByUser = new Map<string, number>();
    for (const s of saves) {
      if (typeof s.savedAt === "number" && s.savedAt < since) continue;
      const id = String(s.userId);
      savesByUser.set(id, (savesByUser.get(id) ?? 0) + 1);
    }

    // Union of everyone who searched or saved in the window.
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
