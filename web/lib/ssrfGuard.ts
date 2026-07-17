// Block requests to private/internal/cloud-metadata hosts.
//
// A hostname-string blocklist alone is bypassable: http://2130706433/ (=
// 127.0.0.1 in decimal), http://0x7f000001/, dotted-octal 0177.0.0.1, IPv4-
// mapped IPv6 ([::ffff:127.0.0.1]), and 0.0.0.0 all point at loopback/internal
// but slip past naive /^127\./-style regexes. So we PARSE any IPv4 the hostname
// could represent — in decimal, hex, octal, or a single packed integer — and
// range-check the actual address, plus cover the IPv6 and internal-suffix forms.

// Parse a hostname as an IPv4 address in ANY inet_aton-style encoding
// (dotted a.b.c.d, a.b.c, a.b, or a single integer; each part decimal, 0x-hex,
// or 0-prefixed octal). Returns the 32-bit address, or null if it isn't one.
function parseIPv4(host: string): number | null {
  const parts = host.split('.')
  if (parts.length < 1 || parts.length > 4) return null
  const nums: number[] = []
  for (const p of parts) {
    if (p === '') return null
    let n: number
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p.slice(2), 16)
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8)
    else if (/^[1-9]\d*$/.test(p) || p === '0') n = parseInt(p, 10)
    else return null
    if (!Number.isFinite(n) || n < 0) return null
    nums.push(n)
  }
  let ip: number
  if (nums.length === 1) {
    ip = nums[0]
  } else if (nums.length === 2) {
    if (nums[0] > 0xff || nums[1] > 0xffffff) return null
    ip = nums[0] * 0x1000000 + nums[1]
  } else if (nums.length === 3) {
    if (nums[0] > 0xff || nums[1] > 0xff || nums[2] > 0xffff) return null
    ip = nums[0] * 0x1000000 + nums[1] * 0x10000 + nums[2]
  } else {
    if (nums.some(n => n > 0xff)) return null
    ip = nums[0] * 0x1000000 + nums[1] * 0x10000 + nums[2] * 0x100 + nums[3]
  }
  if (ip < 0 || ip > 0xffffffff) return null
  return ip >>> 0
}

function isBlockedIPv4(ip: number): boolean {
  const a = (ip >>> 24) & 0xff
  const b = (ip >>> 16) & 0xff
  if (a === 0) return true                          // 0.0.0.0/8 ("this host")
  if (a === 127) return true                        // loopback
  if (a === 10) return true                         // private
  if (a === 172 && b >= 16 && b <= 31) return true  // private
  if (a === 192 && b === 168) return true           // private
  if (a === 169 && b === 254) return true           // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT (100.64/10)
  return false
}

export function isBlockedHost(hostname: string): boolean {
  let h = hostname.toLowerCase().trim()
  if (!h) return true
  // Strip brackets from IPv6 literals ([::1] → ::1)
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1)

  // Internal / loopback hostnames and suffixes
  if (
    h === 'localhost' || h.endsWith('.localhost') ||
    h.endsWith('.local') || h.endsWith('.internal') ||
    h === 'metadata.google.internal'
  ) return true

  // IPv6: loopback, unspecified, link-local (fe80::/10), unique-local (fc00::/7)
  if (h === '::1' || h === '::' || h.startsWith('fe80:') || /^f[cd][0-9a-f]*:/.test(h)) return true
  // IPv4-mapped / -embedded IPv6 (::ffff:127.0.0.1, ::ffff:7f00:1) — pull out any
  // trailing dotted-quad and range-check it.
  if (h.includes(':')) {
    const tail = h.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
    if (tail) {
      const ip = parseIPv4(tail[1])
      if (ip !== null && isBlockedIPv4(ip)) return true
    }
  }

  // Any IPv4 encoding (decimal/hex/octal/packed-integer)
  const ip = parseIPv4(h)
  if (ip !== null && isBlockedIPv4(ip)) return true

  return false
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
