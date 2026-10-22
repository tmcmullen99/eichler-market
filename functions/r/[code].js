// functions/r/[code].js — a letter's QR code: eichlermarket.com/r/<CODE>.
//
// Every code printed on an Eichler Market letter lands here. record_qr_scan records the scan (the desk sees which letter
// was scanned, by whom it was sent and to which home) and names the page the letter is about; the browser goes on to it
// with ?qr=<CODE>. The same contract as the city sites' worker (/r/ in campbell-market/_worker.js).
//
// Until 21 Oct 2026 /r/ on this site was only the static page beside it, which sent every scan to sign-up and recorded
// nothing (Tim: "QR code to the Eichler Market"). An unknown code, or a database that does not answer within 3.5 s,
// still lands on the market's home page: a printed code cannot be recalled, so it must never dead-end.

const SB = 'https://qinuukntpyulqjzndnho.supabase.co'
const KEY = 'sb_publishable_1CzH1AWkEzy1WjMvZqwlhA_xiay_wJ2'

export async function onRequest({ request, params }) {
  const url = new URL(request.url)
  const code = String(params.code || '').toUpperCase()
  const rcp = url.searchParams.get('h') || null   // optional per-recipient hint: an APN or a property slug, never a name
  let host = url.hostname.replace(/^www\./, '')
  let target = '/'
  if (/^[A-Z0-9]{4,12}$/.test(code)) {
    try {
      const ac = new AbortController()
      const t = setTimeout(() => ac.abort(), 3500)
      const r = await fetch(SB + '/rest/v1/rpc/record_qr_scan', {
        method: 'POST', signal: ac.signal,
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_code: code, p_recipient: rcp, p_visitor: url.searchParams.get('v') || null,
          p_ua: request.headers.get('user-agent') || null, p_ref: request.headers.get('referer') || null,
        }),
      })
      clearTimeout(t)
      const j = r.ok ? await r.json() : null
      if (j && j.ok && typeof j.target === 'string' && j.target.startsWith('/')) {
        target = j.target
        if (j.domain && /^[a-z0-9.-]+$/i.test(j.domain)) host = j.domain
      }
    } catch (e) { /* the scan still goes on to the home page */ }
  }
  const dest = 'https://' + host + target + (target.includes('?') ? '&' : '?') + 'qr=' + encodeURIComponent(code)
    + (rcp ? '&qh=' + encodeURIComponent(rcp) : '')
  return new Response(null, { status: 302, headers: { Location: dest, 'Cache-Control': 'no-store' } })
}
