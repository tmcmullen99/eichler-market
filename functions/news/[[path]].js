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
<footer class="footer">Eichler Market · A McMullen Properties initiative · Real estate services provided by Tim McMullen, Broker, CA DRE #02016832 · McMullen Properties, LLC is not itself a licensed brokerage</footer>
<script src="/assets/cm-track.js" defer></script>
</body></html>`;


/* ─────────────────────────────────────────────────────────────────────────
   LOCAL NEWS (Tim, 25 Sep 2026): the same engine as the City Markets.
   Articles and monthly reports are drafted on the city platform (news_articles,
   market 7 = Eichler), edited and published from the agent desk, and rendered
   here -- exactly as sanfranciscocondomarket.com renders market 5. The block
   renderer below is the SF site's, so one article body reads the same on every
   site that shows it. The 505 legacy sale reports (em_posts) keep their URLs:
   an article slug is tried first, then a sale report.
   ───────────────────────────────────────────────────────────────────────── */
const EM_MARKET_ID = 7;
const SB_A_URL = 'https://qinuukntpyulqjzndnho.supabase.co';
const SB_A_KEY = 'sb_publishable_1CzH1AWkEzy1WjMvZqwlhA_xiay_wJ2';
function attr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }
const CM_NEWS_MEDIA = SB_A_URL + '/storage/v1/object/public/news/';
const cmNewsMedia = p => /^https?:\/\//i.test(String(p || '')) ? String(p) : CM_NEWS_MEDIA + p;

async function aNewsRpc(name, body) {
  try {
    const res = await fetch(SB_A_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'apikey': SB_A_KEY, 'Authorization': 'Bearer ' + SB_A_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json();
  } catch (e) { /* fall through */ }
  return null;
}
function cmNewsInline(s) {
  return esc(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, h) => /^\//.test(h)
      ? '<a href="' + h + '">' + t + '</a>'
      : '<a href="' + h + '" rel="nofollow noopener" target="_blank">' + t + '</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function cmNewsBlocks(md) {
  return String(md || '').replace(/\r/g, '').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
}
/* [[payment price=... rate=... asof=...]] becomes a payment calculator, the same
   block the city platform renders, so one article body works on either site. */
function cmPaymentCalcHtml(attrs) {
  const n = k => { const m = attrs.match(new RegExp(k + '=([0-9.]+)')); return m ? Number(m[1]) : null; };
  const price = n('price'), rate = n('rate') || 6.9, down = n('down') || 20;
  if (!price) return '';
  const asof = (attrs.match(/asof=([0-9-]+)/) || [])[1] || '';
  const id = 'pc' + Math.random().toString(36).slice(2, 8);
  return `<div class="nw-calc" id="${id}">
    <div class="nw-calc-h">What it would cost a month</div>
    <div class="nw-calc-grid">
      <label>Price <input type="number" data-f="price" value="${price}" step="5000"></label>
      <label>Down payment <span class="nw-dp"></span> <input type="range" data-f="down" min="0" max="50" step="5" value="${down}"></label>
      <label>Rate % <input type="number" data-f="rate" value="${rate}" step="0.05"></label>
      <label>Term <select data-f="term"><option value="30">30 years</option><option value="15">15 years</option></select></label>
    </div>
    <div class="nw-calc-out"><b class="nw-pay"></b><span class="nw-calc-sub"></span></div>
    <p class="nw-calc-note">Principal and interest only, on the ${rate}% average 30-year rate${asof ? ' published ' + asof : ''} (Freddie Mac). Property taxes, insurance and homeowners' dues are on top, and your own rate will depend on your lender, credit and deposit.</p>
  </div>
  <script>(function(){var r=document.getElementById('${id}');if(!r)return;
    var f=function(k){var e=r.querySelector('[data-f='+k+']');return e?Number(e.value):0};
    var usd=function(v){return '$'+Math.round(v).toLocaleString('en-US')};
    function calc(){var p=f('price'),d=f('down'),rt=f('rate')/100/12,t=f('term')*12,L=p*(1-d/100);
      var m=rt>0?L*rt/(1-Math.pow(1+rt,-t)):L/t;
      r.querySelector('.nw-dp').textContent=d+'% ('+usd(p*d/100)+')';
      r.querySelector('.nw-pay').textContent=usd(m)+' a month';
      r.querySelector('.nw-calc-sub').textContent=usd(L)+' borrowed over '+f('term')+' years';}
    r.querySelectorAll('input,select').forEach(function(e){e.addEventListener('input',calc)});calc();})();</script>`;
}
function cmNewsBlockHtml(b) {
  const pay = b.match(/^\[\[payment\s+([^\]]+)\]\]$/);
  if (pay) return cmPaymentCalcHtml(pay[1]);
  if (/^\|/.test(b)) {
    const rows = b.split('\n').filter(r => r.trim() && !/^\|[\s:|-]+\|$/.test(r.trim()));
    const cells = rows.map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    if (!cells.length) return '';
    return '<div class="nw-tblw"><table><thead><tr>'
      + cells[0].map(c => '<th>' + cmNewsInline(c) + '</th>').join('')
      + '</tr></thead><tbody>'
      + cells.slice(1).map(r => '<tr>' + r.map(c => '<td>' + cmNewsInline(c) + '</td>').join('') + '</tr>').join('')
      + '</tbody></table></div>';
  }
  if (/^###\s/.test(b))   return '<h3>' + cmNewsInline(b.replace(/^###\s/, '')) + '</h3>';
  if (/^##\s/.test(b))    return '<h2>' + cmNewsInline(b.replace(/^##\s/, '')) + '</h2>';
  if (/^>\s?/.test(b))    return '<blockquote>' + cmNewsInline(b.replace(/^>\s?/gm, '')) + '</blockquote>';
  if (/^[-*]\s/.test(b))  return '<ul>' + b.split('\n').map(l => '<li>' + cmNewsInline(l.replace(/^[-*]\s/, '')) + '</li>').join('') + '</ul>';
  if (/^\d+\.\s/.test(b)) return '<ol>' + b.split('\n').map(l => '<li>' + cmNewsInline(l.replace(/^\d+\.\s+/, '')) + '</li>').join('') + '</ol>';
  if (/^---+$/.test(b))   return '<hr>';
  return '<p>' + cmNewsInline(b).replace(/\n/g, '<br>') + '</p>';
}
function cmNewsDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' }); }
  catch (e) { return String(iso).slice(0, 10); }
}
const CM_NEWS_CSS = '<style>' +
'.nw-list{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;padding:26px 0 40px}@media(max-width:760px){.nw-list{grid-template-columns:1fr}}' +
'.nw-card{display:block;border:1px solid var(--line);border-radius:12px;overflow:hidden;text-decoration:none;color:var(--ivory);transition:border-color .15s}.nw-card:hover{border-color:var(--orange)}' +
'.nw-card .ph img{display:block;width:100%;height:190px;object-fit:cover}.nw-card .bd{padding:16px 18px}' +
'.nw-kind{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--orange)}' +
'.nw-card h2{font-family:"Playfair Display",serif;font-size:20px;line-height:1.25;margin:6px 0 8px}.nw-card p{color:#c3ccd9;font-size:14.5px;margin:0}' +
'.nw-meta{font-size:12.5px;color:var(--dim);margin-top:10px}' +
'.nw-empty{border:1px solid var(--line);border-radius:12px;padding:22px;color:#c3ccd9;margin:28px 0 40px}' +
'.nw-art{max-width:720px;margin:0 auto;padding:40px 0 60px}' +
'.nw-crumb{font-size:13px;color:var(--dim);margin-bottom:14px}.nw-crumb a{color:var(--dim);text-decoration:none}.nw-crumb a:hover{color:var(--orange-bright)}' +
'.nw-dek{font-size:18px;color:#c3ccd9;margin:0 0 14px}.nw-by{font-size:13px;color:var(--dim);margin-bottom:26px}' +
'.nw-hero{margin:0 0 26px}.nw-hero img{width:100%;border-radius:12px;display:block}.nw-hero figcaption,.nw-fig figcaption{font-size:12.5px;color:var(--dim);margin-top:8px}' +
'.nw-fig{margin:10px 0 24px}.nw-fig img{width:100%;border-radius:10px;display:block}' +
'.nw-body{font-size:17px;line-height:1.7}.nw-body p{margin:0 0 18px}' +
'.nw-body h2{font-family:"Playfair Display",serif;font-size:25px;margin:36px 0 12px}.nw-body h3{font-size:19px;margin:28px 0 10px}' +
'.nw-body a{color:var(--orange-bright)}.nw-body ul,.nw-body ol{margin:0 0 18px 22px}.nw-body li{margin-bottom:6px}' +
'.nw-body blockquote{border-left:3px solid var(--orange);padding-left:16px;margin:0 0 18px;color:#c3ccd9}' +
'.nw-body hr{border:0;border-top:1px solid var(--line);margin:28px 0}' +
'.nw-tblw{overflow-x:auto;margin:0 0 22px}.nw-calc{border:1px solid #e0e5ed;border-radius:12px;padding:18px 20px;margin:0 0 24px;background:#fff}.nw-calc-h{font:600 12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#7b8794;margin-bottom:12px}.nw-calc-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px 18px}.nw-calc-grid label{display:block;font-size:13px;font-weight:600}.nw-calc-grid input,.nw-calc-grid select{width:100%;margin-top:4px;padding:8px 10px;border:1px solid #e0e5ed;border-radius:7px;font:inherit;font-size:15px;background:#fff}.nw-calc-grid input[type=range]{padding:0}.nw-calc-out{margin-top:16px;padding-top:14px;border-top:1px solid #e0e5ed;display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline}.nw-pay{font:700 26px/1.2 Georgia,serif}.nw-calc-sub{font-size:13px;color:#7b8794}.nw-calc-note{font-size:12.5px;line-height:1.6;color:#7b8794;margin:12px 0 0}@media(max-width:620px){.nw-calc-grid{grid-template-columns:1fr}}.nw-body table{font-size:15px}.nw-body th{white-space:nowrap}' +
'.nw-src{margin-top:30px;padding:16px 18px;border:1px solid var(--line);border-radius:12px;font-size:14px;color:#c3ccd9}.nw-src b{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);margin-bottom:8px}.nw-src a{color:var(--orange-bright)}' +
'.nw-share{display:flex;gap:9px;flex-wrap:wrap;margin-top:24px}.nw-share a{font-size:13px;padding:8px 14px;border:1px solid var(--line);border-radius:99px;text-decoration:none;color:var(--ivory)}.nw-share a:hover{border-color:var(--orange)}' +
'.nw-legal{font-size:12.5px;color:var(--dim);margin-top:30px}' +
'</style>';
const EM_VARS = '<style>:root{--orange:#c8a96e;--orange-bright:#dcc08d;--ivory:#e8e3d8;--dim:rgba(160,172,194,.8);--line:rgba(200,169,110,.18)}' +
  '.nw-card{color:var(--ivory)}.nw-card h2{color:#fff}.nw-body{color:rgba(232,227,216,.88)}.nw-body h2,.nw-body h3{color:#fff}' +
  '.wrap{max-width:1040px}.nw-art{max-width:720px}.em-sec{margin:44px 0 0;padding-top:30px;border-top:1px solid var(--line)}' +
  '.em-sec h2{font-family:"Playfair Display",serif;font-size:26px;font-weight:500;color:#fff;margin:0 0 6px}.em-sec .sub{font-size:14px;color:var(--dim);margin:0 0 18px}' +
  '.em-nav{display:flex;gap:18px;flex-wrap:wrap}.em-nav a{font-size:13px;color:rgba(200,169,110,.85)}</style>';

function NSHELL(title, desc, canonical, jsonld, body) {
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${attr(title)}"><meta property="og:description" content="${attr(desc)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="article">
<link rel="icon" href="/assets/em-favicon.svg">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'DM Sans',system-ui,sans-serif;background:#0e1118;color:#e8e3d8;-webkit-font-smoothing:antialiased;line-height:1.7}
a{color:#c8a96e;text-decoration:none}.nav{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 28px;border-bottom:1px solid rgba(232,227,216,.08)}
.nav-logo{font-family:'Playfair Display',serif;font-size:17px;font-weight:700;color:#fff}.wrap{max-width:1040px;margin:0 auto;padding:40px 28px 90px}
.kick{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(200,169,110,.8);margin-bottom:12px}
h1{font-family:'Playfair Display',serif;font-size:clamp(28px,4.5vw,44px);font-weight:500;line-height:1.15;color:#fff;margin:0 0 14px}
.lede{font-size:16px;color:rgba(232,227,216,.7);max-width:680px}
.card{display:block;padding:18px 0;border-bottom:1px solid rgba(232,227,216,.08)}.card-pocket{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(200,169,110,.7)}
.card-title{font-family:'Playfair Display',serif;font-size:19px;color:#fff;margin:4px 0}.card-meta{font-size:13px;color:rgba(145,161,186,.7)}
.footer{border-top:1px solid rgba(232,227,216,.08);padding:26px 28px;font-size:12px;color:rgba(145,161,186,.6);text-align:center}</style>
${EM_VARS}
</head><body>
<nav class="nav"><a href="/" class="nav-logo">Eichler Market</a><span class="em-nav"><a href="/active-listings">Active listings</a><a href="/news/">Local news</a><a href="/make-me-move/">Make Me Move</a><a href="/how-it-works">How it works</a></span></nav>
<div class="wrap">${body}</div>
<footer class="footer">Eichler Market · Real estate services provided by Tim McMullen, Broker, CA DRE #02016832 · McMullen Properties, LLC is not itself a licensed brokerage</footer>
<script src="/assets/cm-track.js" defer></script>
</body></html>`;
}

async function newsIndex() {
  const base = 'https://eichlermarket.com';
  const [data, posts] = await Promise.all([
    aNewsRpc('get_news_index', { p_market_id: EM_MARKET_ID, p_limit: 30, p_offset: 0 }),
    sbFetch('em_posts?select=slug,title,pocket_name,sale_price,sale_date,ppsf,created_at&status=eq.published&order=created_at.desc&limit=40').catch(() => []),
  ]);
  const arts = (data && data.ok && Array.isArray(data.articles)) ? data.articles : [];
  const cards = arts.map(a => {
    const img = a.hero_path ? '<div class="ph"><img src="' + attr(cmNewsMedia(a.hero_path)) + '" alt="' + attr(a.hero_alt || a.headline) + '" loading="lazy"></div>' : '';
    return '<a class="nw-card" href="/news/' + attr(a.slug) + '/">' + img + '<div class="bd">' +
      '<div class="nw-kind">' + (a.kind === 'market_review' ? 'Monthly market report' : 'Local news') + '</div>' +
      '<h2>' + esc(a.headline) + '</h2>' + (a.dek ? '<p>' + esc(a.dek) + '</p>' : '') +
      '<div class="nw-meta">' + esc(cmNewsDate(a.published_at)) + (a.word_count ? ' \u00b7 ' + Math.max(1, Math.round(a.word_count / 220)) + ' min read' : '') + '</div></div></a>';
  }).join('');
  /* a refused or failed query answers with an object, not a list */
  const sale = (Array.isArray(posts) ? posts : []).map(p => `<a class="card" href="/news/${attr(p.slug)}"><div class="card-pocket">${esc(p.pocket_name || '')}</div>` +
    `<div class="card-title">${esc(p.title)}</div><div class="card-meta">${fmtP(p.sale_price)}${p.ppsf ? ' · $' + p.ppsf + '/sqft' : ''} · ${fmtD(p.sale_date)}</div></a>`).join('');
  const title = 'Eichler news & monthly market reports \u00b7 Eichler Market';
  const desc = 'What is moving the Silicon Valley Eichler market: new listings, recorded sales and a monthly report, with the sample behind every number.';
  const jsonld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url: base + '/news/', description: desc,
    hasPart: arts.slice(0, 20).map(a => ({ '@type': 'NewsArticle', headline: a.headline, url: base + '/news/' + a.slug + '/', datePublished: a.published_at })) };
  const body = CM_NEWS_CSS +
    '<p class="kick">Eichler Market \u00b7 Local news</p><h1>Eichler news</h1>' +
    '<p class="lede">What actually moved the Eichler market, from the recorded sales. A monthly report on the first of every month, and coverage of anything notable in between.</p>' +
    (cards ? '<div class="nw-list">' + cards + '</div>'
           : '<div class="nw-empty">The first Local News pieces are being written. The monthly report for the month just ended goes up in the first days of each month.</div>') +
    (sale ? '<div class="em-sec"><h2>Eichler sale reports</h2><p class="sub">Every recorded Eichler sale, published as it closes.</p>' + sale + '</div>' : '');
  return new Response(NSHELL(title, desc, base + '/news/', jsonld, body),
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=900' } });
}

async function newsArticle(slug) {
  const base = 'https://eichlermarket.com';
  const data = await aNewsRpc('get_news_article', { p_market_id: EM_MARKET_ID, p_slug: slug });
  if (!data || !data.ok || !data.article) return null;
  const a = data.article, canonical = base + '/news/' + a.slug + '/';
  const imgs = Array.isArray(data.images) ? data.images : [];
  const blocks = cmNewsBlocks(a.body_md);
  const fig = im => '<figure class="nw-fig"><img src="' + attr(cmNewsMedia(im.storage_path)) + '" alt="' + attr(im.alt || im.caption || '') + '" loading="lazy">' +
    (im.caption ? '<figcaption>' + esc(im.caption) + '</figcaption>' : '') + '</figure>';
  let bodyHtml = '';
  blocks.forEach((b, i) => { bodyHtml += cmNewsBlockHtml(b); imgs.filter(im => Number(im.after_block) === i + 1).forEach(im => { bodyHtml += fig(im); }); });
  imgs.filter(im => Number(im.after_block) > blocks.length).forEach(im => { bodyHtml += fig(im); });
  const hero = a.hero_path ? '<figure class="nw-hero"><img src="' + attr(cmNewsMedia(a.hero_path)) + '" alt="' + attr(a.hero_alt || a.headline) + '">' +
    (a.hero_caption ? '<figcaption>' + esc(a.hero_caption) + '</figcaption>' : '') + '</figure>' : '';
  const au = a.author || {};
  const sources = (a.sources || []).filter(x => x && x.url);
  const src = sources.length ? '<div class="nw-src"><b>What this piece is reacting to</b><ul>' +
    sources.map(x => '<li><a href="' + attr(x.url) + '" target="_blank" rel="nofollow noopener">' + esc(x.title || x.url) + '</a>' + (x.publisher ? ' \u00b7 ' + esc(x.publisher) : '') + '</li>').join('') + '</ul></div>' : '';
  const shareText = a.share_text || a.headline;
  const share = '<div class="nw-share">' +
    '<a href="https://x.com/intent/post?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(canonical) + '" target="_blank" rel="noopener">Share on X</a>' +
    '<a href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(canonical) + '" target="_blank" rel="noopener">Facebook</a>' +
    '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(canonical) + '" target="_blank" rel="noopener">LinkedIn</a></div>';
  const title = a.meta_title || a.headline, desc = a.meta_description || a.dek || '';
  const jsonld = { '@context': 'https://schema.org', '@type': 'NewsArticle', headline: a.headline, description: desc, url: canonical,
    datePublished: a.published_at, dateModified: a.updated_at || a.published_at, image: a.hero_path ? [cmNewsMedia(a.hero_path)] : undefined,
    author: au.name ? { '@type': 'Person', name: au.name } : undefined, publisher: { '@type': 'Organization', name: 'Eichler Market' } };
  const body = CM_NEWS_CSS + '<article class="nw-art">' +
    '<p class="nw-crumb"><a href="/">Eichler Market</a> \u203a <a href="/news/">News</a></p>' +
    '<h1>' + esc(a.headline) + '</h1>' + (a.dek ? '<p class="nw-dek">' + esc(a.dek) + '</p>' : '') +
    '<div class="nw-by">' + (au.name ? 'By ' + esc(au.name) + ' \u00b7 ' : '') + esc(cmNewsDate(a.published_at)) + '</div>' +
    hero + '<div class="nw-body">' + bodyHtml + '</div>' + src + share +
    '<p class="nw-legal">' + (au.name ? esc(au.name) + (au.dre ? ', CA DRE #' + esc(au.dre) : '') + '. ' : '') +
      (au.brokerage ? 'Real estate services provided by ' + esc(au.brokerage) + (au.brokerage_dre ? ', CA DRE #' + esc(au.brokerage_dre) : '') + '. ' : '') +
      'Figures are from recorded sales; nothing here is an opinion of the value of any home.</p></article>';
  return new Response(NSHELL(title, desc, canonical, jsonld, body),
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=900' } });
}

async function legacyPost(slug) {
  const rows = await sbFetch(`em_posts?select=*&slug=eq.${encodeURIComponent(slug)}&status=eq.published&limit=1`);
  const p = Array.isArray(rows) ? rows[0] : null;
  if (!p) return null;
  const jsonld = `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org", "@type": "Article", "headline": p.title, "datePublished": p.created_at,
    "author": { "@type": "Person", "name": "Tim McMullen", "url": "https://eichlermarket.com" },
    "publisher": { "@type": "Organization", "name": "Eichler Market" },
    "about": { "@type": "Residence", "address": p.sale_address, "name": p.sale_address } })}</scr` + `ipt>`;
  const body = `<div class="eyebrow">${esc(p.pocket_name || 'Eichler Market')} · Sale Report</div><h1>${esc(p.title)}</h1>
    <div class="post-meta">Published ${fmtD(p.created_at.slice(0,10))} · ${esc(p.pocket_name || '')}</div><div class="post-body">${p.body_html}</div>`;
  return new Response(SHELL(p.title, p.meta_desc, body, jsonld), { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
  const slug = parts[1] || null;

  if (slug === 'sitemap.xml') {
    const [posts, idx] = await Promise.all([
      sbFetch('em_posts?select=slug,created_at&status=eq.published&order=created_at.desc&limit=1000').catch(() => []),
      aNewsRpc('get_news_index', { p_market_id: EM_MARKET_ID, p_limit: 500, p_offset: 0 }),
    ]);
    const arts = (idx && idx.ok && Array.isArray(idx.articles)) ? idx.articles : [];
    const urls = arts.map(a => `<url><loc>https://eichlermarket.com/news/${a.slug}/</loc><lastmod>${String(a.published_at || '').slice(0, 10)}</lastmod></url>`).join('') +
      (Array.isArray(posts) ? posts : []).map(p => `<url><loc>https://eichlermarket.com/news/${p.slug}</loc><lastmod>${p.created_at.slice(0,10)}</lastmod></url>`).join('');
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://eichlermarket.com/news/</loc></url>${urls}</urlset>`,
      { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
  }
  if (slug) {
    if (/^[a-z0-9-]+$/.test(slug)) { const r = await newsArticle(slug); if (r) return r; }
    const l = await legacyPost(slug); if (l) return l;
    return new Response(NSHELL('Not found \u00b7 Eichler Market', 'Article not found.', 'https://eichlermarket.com/news/', {},
      '<article class="nw-art"><h1>That article isn\u2019t here</h1><p class="nw-dek">It may have been moved or taken down. <a href="/news/">See all Eichler news</a>.</p></article>'),
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return newsIndex();
}
