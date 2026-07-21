import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { gatherReport, reportToMarkdown } from '@/lib/services/analyticsReport'

export const runtime = 'nodejs'

function getConvex(): ConvexHttpClient {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set')
  return new ConvexHttpClient(url.trim().replace(/\/+$/, ''))
}
function authorized(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  // Header only — never accept the secret in the URL query string, which would
  // leak it into browser history, access logs, and Referer headers. The
  // dashboard fetches with this header and opens the result as a blob URL, so
  // the print/PDF view never needs the secret in the URL.
  return req.headers.get('x-admin-secret') === secret
}

// Minimal, controlled Markdown → HTML (only the constructs reportToMarkdown emits).
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s: string) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
  const splitRow = (line: string) => line.replace(/^\|/, '').replace(/\|\s*$/, '').split(/(?<!\\)\|/).map(s => s.trim().replace(/\\\|/g, '|'))
  const lines = md.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^### /.test(line)) { out.push(`<h3>${inline(line.slice(4))}</h3>`); i++; continue }
    if (/^## /.test(line)) { out.push(`<h2>${inline(line.slice(3))}</h2>`); i++; continue }
    if (/^# /.test(line)) { out.push(`<h1>${inline(line.slice(2))}</h1>`); i++; continue }
    if (/^---\s*$/.test(line)) { out.push('<hr/>'); i++; continue }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const header = splitRow(line); i += 2
      const rows: string[][] = []
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++ }
      let t = '<table><thead><tr>' + header.map(h => `<th>${inline(h)}</th>`).join('') + '</tr></thead><tbody>'
      for (const r of rows) t += '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>'
      out.push(t + '</tbody></table>'); continue
    }
    if (/^- /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^- /.test(lines[i])) { items.push(`<li>${inline(lines[i].slice(2))}</li>`); i++ }
      out.push('<ul>' + items.join('') + '</ul>'); continue
    }
    if (/^\s*$/.test(line)) { i++; continue }
    out.push(`<p>${inline(line)}</p>`); i++
  }
  return out.join('\n')
}

function printPage(bodyHtml: string, autoPrint: boolean): string {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Discern Analytics Report</title>
<style>
  :root{color-scheme:light}
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1d1f;max-width:820px;margin:0 auto;padding:40px 32px;line-height:1.5}
  h1{font-size:24px;letter-spacing:-0.01em;margin:0 0 4px}
  h2{font-size:16px;margin:28px 0 10px;padding-bottom:6px;border-bottom:1px solid #e5e5e3}
  h3{font-size:14px;margin:18px 0 8px}
  p{margin:8px 0;font-size:13px}
  em{color:#6e6e73;font-style:italic}
  ul{margin:8px 0;padding-left:20px}
  li{font-size:13px;margin:3px 0}
  code{background:#f2f2f0;padding:1px 5px;border-radius:4px;font-size:12px;font-family:ui-monospace,Menlo,monospace}
  table{border-collapse:collapse;width:100%;margin:10px 0;font-size:12.5px}
  th{text-align:left;color:#6e6e73;font-weight:600;border-bottom:1.5px solid #d5d5d3;padding:6px 8px}
  td{padding:6px 8px;border-bottom:1px solid #eee}
  hr{border:none;border-top:1px solid #e5e5e3;margin:24px 0}
  @media print{body{padding:0}a{display:none}h2{page-break-after:avoid}table,ul{page-break-inside:avoid}}
</style></head><body>
${bodyHtml}
${autoPrint ? '<script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350))</script>' : ''}
</body></html>`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const daysParam = Number(req.nextUrl.searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 3650) : 30
  const format = (req.nextUrl.searchParams.get('format') || 'md').toLowerCase()
  const stamp = new Date().toISOString().slice(0, 10)

  let convex: ConvexHttpClient
  try { convex = getConvex() } catch (e: any) {
    return NextResponse.json({ error: 'Convex not configured', detail: e?.message }, { status: 500 })
  }

  const data = await gatherReport(convex, process.env.ADMIN_SECRET!, process.env.CONVEX_AUTH_SECRET, days)
  const md = reportToMarkdown(data)

  if (format === 'html' || format === 'pdf') {
    const autoPrint = req.nextUrl.searchParams.get('print') === '1' || format === 'pdf'
    return new NextResponse(printPage(mdToHtml(md), autoPrint), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }

  // Default: Markdown download (best format to feed to an AI).
  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="discern-analytics-${stamp}.md"`,
      'Cache-Control': 'no-store',
    },
  })
}
