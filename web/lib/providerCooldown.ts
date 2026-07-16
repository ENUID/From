// Shared rate-limit cooldown tracker for every AI provider (OpenRouter, Groq
// direct, Cerebras, Gemini) — in-memory, per warm serverless instance.
//
// Root cause this exists to fix: stylistChat/relevanceRerank build a 3-4
// provider fallback chain per request specifically so ONE provider's free-tier
// quota running out is a non-event. But each provider's own low-level call
// used to respond to a 429 by sleeping and retrying the SAME provider (up to
// ~16s wasted across 2 retries) before ever falling through to the next one —
// a free-tier rate limit does not clear in seconds, so that retry was really
// just burning time. Across a whole session, once OpenRouter's free cap in
// particular is exhausted (the primary provider, so it's tried FIRST on
// nearly every call), every subsequent search paid that ~16s tax again before
// even reaching a provider that could actually answer — several turns of that
// stacked against the route's own maxDuration is exactly how a session that
// worked fine for the first few queries starts throwing "can't reach Fabrics"
// after 3-4 of them.
//
// Fix, two parts: (1) a 429 marks the provider on cooldown and fails
// IMMEDIATELY instead of sleeping-then-retrying itself; (2) any call checks
// the cooldown BEFORE spending a network round trip, so once a provider is
// known-exhausted this instance, later turns skip straight past it.
const cooldowns = new Map<string, number>()

export function markRateLimited(provider: string, cooldownMs = 45_000): void {
  cooldowns.set(provider, Date.now() + cooldownMs)
}

export function isOnCooldown(provider: string): boolean {
  const until = cooldowns.get(provider)
  if (until === undefined) return false
  if (Date.now() > until) {
    cooldowns.delete(provider)
    return false
  }
  return true
}
