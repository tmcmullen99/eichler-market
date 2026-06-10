// Server-rendered /news/ — Eichler Market SEO loop
// /news/            → index of sale posts
// /news/{slug}      → individual post with schema.org markup
// /news/sitemap.xml → sitemap for search engines

const SUPABASE_URL = 'https://kfqphwerygccpzntbbif.supabase.co';
const ANON_KEY = 'sb_publishable_cR53l68E0KtOpANRKiVi7Q_Vx57yQb0';

async function sbFetch(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    cf: { cacheTtl: 300, cacheEverything: true }
  });
  return r.json();
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtP = n => n ? '$' + Number(n).toLocaleString() : '';
const fmtD = d => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'}) : '';

const SHELL = (title, meta, body, jsonld) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(meta)}">
<link rel="icon" href="/assets/em-favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
${jsonld || ''}
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;background:#0e1118;color:#e8e3d8;-webkit-font-smoothing:antialiased;line-height:1.75}
a{color:#c8a96e;text-decoration:none}
.nav{display:flex;align-items:center;justify-content:space-between;padding:18px 28px;border-bottom:1px solid rgba(232,227,216,.08)}
.nav-logo{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff}
.nav a.back{font-size:13px;color:rgba(145,161,186,.65)}
.wrap{max-width:720px;margin:0 auto;padding:56px 28px 96px}
.eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(200,169,110,.7);margin-bottom:14px}
h1{font-family:'Playfair Display',serif;font-size:clamp(28px,4.5vw,42px);font-weight:500;line-height:1.15;margin-bottom:12px;color:#fff}
.post-meta{font-size:13px;color:rgba(145,161,186,.55);margin-bottom:36px}
.post-body p{font-size:16px;color:rgba(232,227,216,.82);margin-bottom:18px;font-weight:300}
.post-body h2{font-family:'Playfair Display',serif;font-size:24px;font-weight:500;color:#fff;margin:36px 0 14px}
.post-body strong{color:#e8e3d8;font-weight:600}
.post-body table{width:100%;border-collapse:collapse;margin:20px 0;font-size:15px}
.post-body td{padding:11px 12px;border-bottom:1px solid rgba(232,227,216,.07);color:rgba(232,227,216,.8)}
.post-body td:first-child{font-weight:600;color:#e8e3d8;width:42%}
.card{display:block;background:#1a1f2e;border:1px solid rgba(232,227,216,.1);border-radius:14px;padding:24px;margin-bottom:14px;transition:border-color .15s}
.card:hover{border-color:rgba(200,169,110,.35)}
.card-pocket{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#c8a96e;margin-bottom:8px}
.card-title{font-family:'Playfair Display',serif;font-size:20px;font-weight:500;color:#fff;line-height:1.25;margin-bottom:6px}
.card-meta{font-size:13px;color:rgba(145,161,186,.55)}
.empty{text-align:center;padding:64px 0;color:rgba(145,161,186,.5)}
.footer{padding:28px;text-align:center;font-size:11px;color:rgba(145,161,186,.4);border-top:1px solid rgba(232,227,216,.06);line-height:1.8}
</style>
</head>
<body>
<nav class="nav"><a href="/" class="nav-logo">Eichler Market</a><a href="/news/" class="back">← All sale reports</a></nav>
<div class="wrap">${body}</div>
<footer class="footer">Eichler Market · A McMullen Properties initiative · Tim McMullen, DRE #02016832 · McMullen Properties operates under Real Broker (DRE #02228473)</footer>
<script src="/assets/cm-track.js" defer></script>
</body></html>`;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  // parts: ['news'] or ['news', slug] or ['news','sitemap.xml']
  const slug = parts[1] || null;

  // ── Sitemap ──
  if (slug === 'sitemap.xml') {
    const posts = await sbFetch('em_posts?select=slug,created_at&status=eq.published&order=created_at.desc&limit=1000');
    const urls = (posts || []).map(p =>
      `<url><loc>https://eichlermarket.com/news/${p.slug}</loc><lastmod>${p.created_at.slice(0,10)}</lastmod></url>`
    ).join('');
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://eichlermarket.com/news/</loc></url>${urls}</urlset>`,
      { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } }
    );
  }

  // ── Individual post ──
  if (slug) {
    const rows = await sbFetch(`em_posts?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
    const p = rows && rows[0];
    if (!p) return new Response('Not found', { status: 404 });

    const jsonld = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": p.title,
      "datePublished": p.created_at,
      "author": { "@type": "Person", "name": "Tim McMullen", "url": "https://eichlermarket.com" },
      "publisher": { "@type": "Organization", "name": "Eichler Market" },
      "about": {
        "@type": "Residence",
        "address": p.sale_address,
        "name": p.sale_address
      }
    })}</scr` + `ipt>`;

    const body = `
      <div class="eyebrow">${esc(p.pocket_name || 'Eichler Market')} · Sale Report</div>
      <h1>${esc(p.title)}</h1>
      <div class="post-meta">Published ${fmtD(p.created_at.slice(0,10))} · ${esc(p.pocket_name || '')}</div>
      <div class="post-body">${p.body_html}</div>`;
    return new Response(SHELL(p.title, p.meta_desc, body, jsonld), {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
    });
  }

  // ── Index ──
  const posts = await sbFetch('em_posts?select=slug,title,pocket_name,sale_price,sale_date,ppsf,created_at&status=eq.published&order=created_at.desc&limit=50');
  const cards = (posts && posts.length)
    ? posts.map(p => `
      <a class="card" href="/news/${p.slug}">
        <div class="card-pocket">${esc(p.pocket_name || '')}</div>
        <div class="card-title">${esc(p.title)}</div>
        <div class="card-meta">${fmtP(p.sale_price)}${p.ppsf ? ' · $' + p.ppsf + '/sqft' : ''} · ${fmtD(p.sale_date)}</div>
      </a>`).join('')
    : `<div class="empty">Sale reports publish automatically as Eichler sales close. Check back soon.</div>`;

  const body = `
    <div class="eyebrow">Eichler Market · Sale Reports</div>
    <h1>Every Eichler sale, on the record.</h1>
    <p style="font-size:15px;color:rgba(232,227,216,.6);margin-bottom:40px;font-weight:300">Auto-published the moment a sale closes in any of our 54 Silicon Valley Eichler communities — price, $/sqft, and what it means for the neighborhood.</p>
    ${cards}`;
  return new Response(SHELL('Eichler Sale Reports · Eichler Market', 'Every Eichler sale in Silicon Valley, on the record — price, $/sqft, and neighborhood impact.', body), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' }
  });
}
