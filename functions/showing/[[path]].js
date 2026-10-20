// functions/showing/[[path]].js — a page Tim built for one buyer, on Eichler Market.
//
// /showing/<slug>/ serves a hand-built page kept in the City Markets database
// (market_pages, market 7 = Eichler Market, read through get_market_page:
// published rows only; ?preview=<token> through get_market_page_preview). The
// first one (20 Oct 2026) is Krishna's Sunnyvale off-market search: a map of
// long-held Eichlers for him to pick the homes Tim should approach.
//
// The page body brings its own styles and scripts; this wraps it in Eichler
// Market's header, section menu and footer. Leaflet is loaded for its map.
// Unlisted: noindex, private no-store, no sitemap entry.

const SB_A_URL = 'https://qinuukntpyulqjzndnho.supabase.co';
const SB_A_KEY = 'sb_publishable_1CzH1AWkEzy1WjMvZqwlhA_xiay_wJ2';
const EM_MARKET_ID = 7;

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const HEAD = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
};

async function rpc(fn, args) {
  try {
    const r = await fetch(SB_A_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: SB_A_KEY, Authorization: 'Bearer ' + SB_A_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const parts = [].concat(context.params.path || []).filter(Boolean);
  const slug = String(parts[0] || '').toLowerCase();
  if (parts.length !== 1 || !/^[a-z0-9][a-z0-9-]{3,120}$/.test(slug)) return context.next();
  if (!url.pathname.endsWith('/')) return Response.redirect(url.origin + url.pathname + '/' + url.search, 301);

  const pv = (url.searchParams.get('preview') || '').slice(0, 64);
  const pg = pv
    ? await rpc('get_market_page_preview', { p_market_id: EM_MARKET_ID, p_slug: slug, p_token: pv })
    : await rpc('get_market_page', { p_market_id: EM_MARKET_ID, p_slug: slug });
  /* only hand-built bodies render here; Build A Page templates live in the city worker */
  if (!pg || pg.ok !== true || !pg.body_html || pg.template) return notFound();
  if (pg.path ? pg.path !== '/showing/' + slug + '/' : pg.kind !== 'listing') return notFound();

  const body = String(pg.body_html);
  /* the section menu, from the page's own sections: <section id="x" data-pnav="01|Label"> */
  const items = [];
  body.replace(/<(?:section|header|div)\b[^>]*?\bid="([A-Za-z0-9_-]+)"[^>]*?\bdata-pnav="([^"]*)"/g, (m0, id, lab) => {
    const [n, t] = String(lab).split('|'); items.push({ id, n: (n || '').trim(), t: (t || '').trim() }); return m0;
  });
  const menu = items.length
    ? '<nav class="emp-menu" aria-label="On this page"><div class="emp-menu-in">'
      + items.map((i) => '<a href="#' + esc(i.id) + '">' + (i.n ? '<b>' + esc(i.n) + '</b>' : '') + esc(i.t) + '</a>').join('')
      + '</div></nav>'
    : '';

  const title = pg.title || 'Eichler Market';
  const desc = pg.description || '';
  const og = pg.og_image || '';
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Eichler Market">
<meta property="og:title" content="${esc(title.split(' | ')[0])}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="https://eichlermarket.com/showing/${esc(slug)}/">
${og ? `<meta property="og:image" content="${esc(og)}">
<meta property="og:image:secure_url" content="${esc(og)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(og)}">` : ''}
<link rel="icon" href="/assets/em-favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<style>
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#f8f5f0;color:#22262f;font-family:'DM Sans',system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
img{max-width:100%}
.wrap{max-width:1180px;margin:0 auto;padding:0 24px}
.emp-hdr{background:#0e1118;border-bottom:1px solid rgba(232,227,216,.08)}
.emp-hdr-in{max-width:1180px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:14px}
.emp-logo{font-family:'Playfair Display',Georgia,serif;font-size:19px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:.01em}
.emp-call{font-size:13.5px;color:#cfd5df;text-decoration:none;border:1px solid rgba(232,227,216,.22);border-radius:999px;padding:7px 14px;white-space:nowrap}
.emp-call:hover{border-color:rgba(232,227,216,.5)}
.emp-menu{position:sticky;top:0;z-index:950;background:#1a1f2e;border-bottom:1px solid rgba(232,227,216,.06)}
.emp-menu-in{max-width:1180px;margin:0 auto;padding:8px 18px;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;justify-content:center}
.emp-menu-in::-webkit-scrollbar{display:none}
.emp-menu a{flex:none;color:#c3cad6;text-decoration:none;font-size:14px;padding:8px 14px;border-radius:999px;white-space:nowrap}
.emp-menu a b{font:500 10.5px 'JetBrains Mono',ui-monospace,monospace;color:#7f8ba0;margin-right:7px}
.emp-menu a.on{background:#e8e3d8;color:#1a1f2e}
.emp-menu a.on b{color:#4f6382}
.km header,.km section{scroll-margin-top:70px!important}
.emp-ftr{background:#0e1118;color:rgba(200,207,219,.62);font-size:12px;line-height:1.8;margin-top:24px}
.emp-ftr-in{max-width:1180px;margin:0 auto;padding:28px 24px 34px}
.emp-ftr b{font-family:'Playfair Display',Georgia,serif;font-size:16px;color:#fff;font-weight:700;display:block;margin-bottom:6px}
.emp-ftr a{color:#cfd5df}
@media(max-width:900px){.emp-menu-in{justify-content:flex-start}}
@media(max-width:560px){.wrap,.emp-hdr-in,.emp-ftr-in{padding-left:16px;padding-right:16px}.emp-hdr-in{height:52px}.emp-logo{font-size:17px}.emp-call{font-size:12.5px;padding:6px 11px}}
</style>
</head>
<body>
<header class="emp-hdr"><div class="emp-hdr-in">
<a class="emp-logo" href="/">Eichler Market</a>
<a class="emp-call" href="tel:+14156919272">Call Tim · 415 691 9272</a>
</div></header>
${menu}
${body}
<footer class="emp-ftr"><div class="emp-ftr-in">
<b>Eichler Market</b>
&copy; 2026 Eichler Market &middot; McMullen Properties LLC &middot; Tim McMullen, Broker, CA DRE&nbsp;#02016832. Sales data from MLSListings; information deemed reliable but not guaranteed. Eichler&reg; is a trademark of its respective owner; Eichler Market is independent and not affiliated with the Eichler estate.<br>
<a href="mailto:Tim@eichlermarket.com">Tim@eichlermarket.com</a> &middot; <a href="tel:+14156919272">415 691 9272</a>
</div></footer>
${items.length ? `<script>(function(){var ls=[].slice.call(document.querySelectorAll('.emp-menu a'));if(!ls.length||!('IntersectionObserver' in window))return;
var by={};ls.forEach(function(a){by[a.getAttribute('href').slice(1)]=a;});
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;ls.forEach(function(a){a.classList.remove('on');});var a=by[e.target.id];if(a){a.classList.add('on');a.scrollIntoView({block:'nearest',inline:'nearest'});}});},{rootMargin:'-45% 0px -50% 0px'});
Object.keys(by).forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el);});})();</script>` : ''}
<script src="/assets/cm-track.js" defer></script>
</body>
</html>`;
  return new Response(html, { status: 200, headers: HEAD });
}

function notFound() {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>This page is not live — Eichler Market</title>
<style>body{margin:0;background:#0e1118;color:#e8e3d8;font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;line-height:1.6}
.w{max-width:520px;margin:0 auto;padding:80px 22px}h1{font-family:Georgia,serif;font-size:1.5rem;margin:0 0 12px;color:#fff}
p{color:#aab3c2}a{color:#e8e3d8}</style></head><body><div class="w">
<h1>This page is not live</h1>
<p>The link may have been mistyped, or the page has been taken down.</p>
<p>If you were expecting to see something here, <a href="mailto:Tim@eichlermarket.com">email Tim</a> or call 415 691 9272.</p>
<p><a href="/">Eichler Market</a></p></div></body></html>`;
  return new Response(html, { status: 404, headers: HEAD });
}
