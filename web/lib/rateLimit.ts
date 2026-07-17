// Shared per-IP sliding-window rate limiter for public, unauthenticated
// routes — the same pattern api/ai/stylist and api/auth/send-code grew
// independently, extracted so every quota-burning endpoint (LLM calls,
// store scrapes) can guard itself with one line instead of a fourth copy.
//
// In-memory and therefore per-serverless-instance: this is abuse friction,
// not a hard global quota — a determined attacker hitting many cold
// instances gets more than maxRequests, but each instance still refuses
// runaway loops and cheap scripted floods, which is what actually happens.
export function makeIpRateLimiter(maxRequests: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>()
  return function isRateLimited(req: { headers: { get(name: string): string | null } }): boolean {
    // Prefer x-vercel-forwarded-for — Vercel sets it from the real edge
    // connection and a client can't forge it. The leftmost x-forwarded-for is
    // client-influenceable, so rotating a spoofed value would reset the bucket
    // and defeat the limiter (e.g. the send-code email-bomb guard).
    const ip = req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')?.trim()
      ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? 'unknown'
    const now = Date.now()
    // Opportunistic sweep so the map can't grow without bound on a
    // long-lived instance being scanned from many IPs.
    if (buckets.size > 5000) {
      buckets.forEach((b, key) => {
        if (now > b.resetAt) buckets.delete(key)
      })
    }
    const bucket = buckets.get(ip)
    if (!bucket || now > bucket.resetAt) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs })
      return false
    }
    if (bucket.count >= maxRequests) return true
    bucket.count++
    return false
  }
}
