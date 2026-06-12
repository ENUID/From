// Block requests to private/internal/cloud-metadata hosts
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return (
    h === 'localhost' ||
    h === '::1' ||
    h === 'metadata.google.internal' ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) // AWS/Azure/GCP link-local metadata
  )
}

export function safeParseStoreUrl(raw: string): { protocol: string; hostname: string; origin: string } | null {
  try {
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol)) return null
    if (isBlockedHost(u.hostname)) return null
    return { protocol: u.protocol, hostname: u.hostname, origin: `${u.protocol}//${u.hostname}` }
  } catch {
    return null
  }
}
