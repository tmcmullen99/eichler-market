// Cloudflare Pages Function — /listing/{mls}/
// Server-renders a single Eichler listing detail page from v_eichler_active_listings.
// v1: primary photo + full specs + guarded community link. Gallery is a v2 effort.

const SB_URL = 'https://kfqphwerygccpzntbbif.supabase.co';
const SB_KEY = 'sb_publishable_cR53l68E0KtOpANRKiVi7Q_Vx57yQb0';

// Community pages that exist (only these slugs are safe to link).
const PAGES = new Set([
  '19th-avenue-park',
  'atherton-eichlers',
  'atherwood',
  'bay-vista',
  'belmont-eichlers',
  'campbell-eichlers',
  'charleston-meadows',
  'cuernavaca',
  'cupertino-eichlers',
  'east-palo-alto-eichlers',
  'eichler-campbell',
  'eichler-cupertino',
  'eichler-gilroy',
  'eichler-los-altos-hills',
  'eichler-los-gatos',
  'eichler-milpitas',
  'eichler-monte-sereno',
  'eichler-morgan-hill',
  'eichler-mountain-view',
  'eichler-san-jose',
  'eichler-santa-clara',
  'eichler-saratoga',
  'eichler-stanford',
  'eichler-sunnyvale',
  'eichler-sunnyvale-vanderbilt-area',
  'el-granada-eichlers',
  'fairbrae',
  'fairglen',
  'fairwood',
  'fairwood-redwood-city',
  'foster-city-eichlers',
  'gilroy-eichlers',
  'green-gables',
  'greenmeadow',
  'hillsborough-eichlers',
  'ladera',
  'los-altos-eichlers',
  'los-altos-hills-eichlers',
  'los-gatos-eichlers',
  'marina-point',
  'maywood-park',
  'menlo-oaks',
  'menlo-park-eichlers',
  'millbrae-eichlers',
  'mills-estates',
  'milpitas-eichlers',
  'monte-sereno-eichlers',
  'morgan-hill-eichlers',
  'mountain-view-eichlers',
  'oakdell-park',
  'palo-alto-eichlers',
  'palo-alto-other-eichlers',
  'palo-verde',
  'rancho-verde',
  'redwood-city-eichlers',
  'roseglen',
  'san-bruno-eichlers',
  'san-carlos-eichlers',
  'san-jose-eichlers',
  'san-jose-other-eichlers',
  'san-mateo-highlands',
  'san-mateo-other-eichlers',
  'santa-clara-eichlers',
  'saratoga-eichlers',
  'sequoia-meadow',
  'shadygrove',
  'south-los-altos-eichlers',
  'stanford-eichlers',
  'stanford-gardens',
  'stanford-palo-alto-hills',
  'sunnyvale-eichlers',
  'sunnyvale-other-eichlers',
  'sunnyvale-vanderbilt-tract',
  'treasure-isle',
  'woodside-eichlers'
]);
const ALIAS = { 'portola-valley-eichlers': 'ladera' };

function communityHref(slug) {
  if (!slug) return null;
  if (PAGES.has(slug)) return '/community/' + slug + '/';
  if (ALIAS[slug] && PAGES.has(ALIAS[slug])) return '/community/' + ALIAS[slug] + '/';
  return null;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function money(n) {
  if (n == null) return '';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2) + 'M';
  return '$' + Number(n).toLocaleString();
}

function shell(inner, title, desc) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="icon" href="/assets/em-favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--n:#1a1f2e;--warm:#c8a96e;--g:#91a1ba}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;color:var(--n);background:#fff;line-height:1.55}
a{color:inherit}
.nav{position:sticky;top:0;z-index:50;display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:rgba(26,31,46,.96);backdrop-filter:blur(8px)}
.nav-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff}
.nav-icon{width:30px;height:30px;border-radius:8px;background:rgba(200,169,110,.15);display:flex;align-items:center;justify-content:center}
.nav-brand-name{font-family:'Playfair Display',serif;font-size:18px;font-weight:600}
.nav-cta{background:var(--warm);color:var(--n);text-decoration:none;padding:9px 18px;font-size:13px;font-weight:700;border-radius:100px}
.wrap{max-width:1080px;margin:0 auto;padding:32px 24px 80px}
.crumb{font-size:13px;color:var(--g);margin-bottom:22px}
.crumb a{color:var(--warm);text-decoration:none}
.hero-img{width:100%;aspect-ratio:16/9;border-radius:16px;background:#eceef2 center/cover;margin-bottom:28px}
.hero-img-none{width:100%;aspect-ratio:16/9;border-radius:16px;background:var(--n);display:flex;align-items:center;justify-content:center;color:#3a4256;margin-bottom:28px}
.top{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;margin-bottom:8px}
.price{font-family:'Playfair Display',serif;font-size:clamp(32px,5vw,44px);font-weight:500}
.status{display:inline-block;background:#16a34a;color:#fff;font-size:11px;font-weight:700;padding:5px 11px;border-radius:6px;letter-spacing:.06em;text-transform:uppercase;margin-top:10px}
.addr{font-size:19px;font-weight:600;margin-bottom:4px}
.loc{font-size:15px;color:var(--g);margin-bottom:24px}
.specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:1px;background:#e6e9ee;border:1px solid #e6e9ee;border-radius:12px;overflow:hidden;margin-bottom:28px}
.spec{background:#fff;padding:18px 16px;text-align:center}
.spec-v{font-family:'Playfair Display',serif;font-size:24px;color:var(--n)}
.spec-l{font-size:11px;color:var(--g);text-transform:uppercase;letter-spacing:.07em;margin-top:3px}
.section{margin-bottom:26px}
.section h2{font-family:'Playfair Display',serif;font-size:20px;font-weight:500;margin-bottom:10px}
.detail-row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eef1f4;font-size:14px}
.detail-row span:first-child{color:var(--g)}
.cta-box{background:var(--n);border-radius:16px;padding:28px;margin-top:32px;color:#fff}
.cta-box h3{font-family:'Playfair Display',serif;font-size:22px;font-weight:500;margin-bottom:8px}
.cta-box p{color:rgba(255,255,255,.6);font-size:14px;margin-bottom:18px}
.cta-row{display:flex;gap:12px;flex-wrap:wrap}
.btn{padding:12px 22px;border-radius:100px;font-size:14px;font-weight:700;text-decoration:none;display:inline-block}
.btn-gold{background:var(--warm);color:var(--n)}
.btn-ghost{border:1px solid rgba(255,255,255,.25);color:#fff}
.disc{font-size:11px;color:var(--g);margin-top:36px;line-height:1.7;border-top:1px solid #eef1f4;padding-top:18px}
footer{background:var(--n);color:var(--g);padding:30px 24px;text-align:center;font-size:12px}
footer a{color:var(--warm);text-decoration:none}
</style></head><body>
<nav class="nav">
  <a href="/" class="nav-brand">
    <span class="nav-icon"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
    <span class="nav-brand-name">Eichler Market</span>
  </a>
  <a href="/make-me-move/" class="nav-cta">Make Me Move</a>
</nav>
${inner}
<footer>Eichler Market · McMullen Properties · DRE #02016832 · Operating under Real Broker, DRE #02228473 · <a href="/">eichlermarket.com</a></footer>
</body></html>`;
}

function notFound(mls) {
  const inner = `<div class="wrap">
    <div class="crumb"><a href="/">Home</a> · <a href="/active-listings/">Active listings</a> · Not found</div>
    <h1 style="font-family:'Playfair Display',serif;font-size:32px;font-weight:500;margin-bottom:10px">Listing not found</h1>
    <p style="color:#91a1ba;font-size:15px;margin-bottom:24px">We couldn't find an active listing for MLS #${esc(mls)}. It may have sold or been taken off the market.</p>
    <a class="btn btn-gold" href="/active-listings/">View active listings &rarr;</a>
  </div>`;
  return shell(inner, 'Listing not found · Eichler Market', 'This Eichler listing is no longer active.');
}

export async function onRequest(context) {
  const { params } = context;
  let mls = params.mls;
  if (Array.isArray(mls)) mls = mls[0];
  mls = decodeURIComponent(mls || '').trim();

  if (!mls) {
    return new Response(notFound(''), { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }

  // Fetch the one listing by MLS number
  let rows = [];
  try {
    const url = `${SB_URL}/rest/v1/v_eichler_active_listings?mls_number=eq.${encodeURIComponent(mls)}&select=*&limit=1`;
    const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    if (r.ok) rows = await r.json();
  } catch (e) {
    rows = [];
  }

  if (!rows.length) {
    return new Response(notFound(mls), { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
  }

  const p = rows[0];
  const chref = communityHref(p.community_slug);
  const commLink = chref
    ? `<a href="${chref}" style="color:var(--warm);text-decoration:none">${esc(p.community_name)}</a>`
    : (p.community_name ? esc(p.community_name) : '\u2014');

  const photo = p.photo_url
    ? `<div class="hero-img" style="background-image:url('${esc(p.photo_url)}')"></div>`
    : `<div class="hero-img-none">No photo available</div>`;

  const specCell = (v, l) => v ? `<div class="spec"><div class="spec-v">${esc(v)}</div><div class="spec-l">${esc(l)}</div></div>` : '';
  const specs = [
    specCell(p.beds, 'Beds'),
    specCell(p.baths, 'Baths'),
    specCell(p.sqft ? Number(p.sqft).toLocaleString() : '', 'Sq Ft'),
    specCell(p.lot_sqft ? Number(p.lot_sqft).toLocaleString() : '', 'Lot Sq Ft'),
    specCell(p.year_built, 'Year Built'),
  ].join('');

  const detailRow = (l, v) => v ? `<div class="detail-row"><span>${esc(l)}</span><span>${esc(v)}</span></div>` : '';
  const ppsf = (p.price && p.sqft) ? '$' + Math.round(p.price / p.sqft).toLocaleString() + '/sf' : '';
  const listed = p.first_listed_at ? new Date(p.first_listed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

  const mlsLink = p.listing_url
    ? `<a class="btn btn-ghost" href="${esc(p.listing_url)}" target="_blank" rel="noopener">View on MLS &rarr;</a>` : '';

  const inner = `<div class="wrap">
  <div class="crumb"><a href="/">Home</a> · <a href="/active-listings/">Active listings</a> · ${esc(p.address)}</div>
  ${photo}
  <div class="top">
    <div>
      <div class="price">${money(p.price)}</div>
      <div class="status">Active</div>
    </div>
  </div>
  <div style="margin-top:18px">
    <div class="addr">${esc(p.address)}</div>
    <div class="loc">${esc([p.city, p.zip].filter(Boolean).join(', '))} · in ${commLink}</div>
  </div>
  <div class="specs">${specs}</div>
  <div class="section">
    <h2>Details</h2>
    ${detailRow('Price', money(p.price))}
    ${detailRow('Price per sq ft', ppsf)}
    ${detailRow('Bedrooms', p.beds)}
    ${detailRow('Bathrooms', p.baths)}
    ${detailRow('Living area', p.sqft ? Number(p.sqft).toLocaleString() + ' sq ft' : '')}
    ${detailRow('Lot size', p.lot_sqft ? Number(p.lot_sqft).toLocaleString() + ' sq ft' : '')}
    ${detailRow('Year built', p.year_built)}
    ${detailRow('Community', p.community_name)}
    ${detailRow('Listed', listed)}
    ${detailRow('MLS number', p.mls_number)}
  </div>
  <div class="cta-box">
    <h3>Interested in ${esc(p.address)}?</h3>
    <p>Submit an offer through Eichler Market at a flat 3% — or ask Tim anything about this home or the ${esc(p.community_name || 'neighborhood')}.</p>
    <div class="cta-row">
      <a class="btn btn-gold" href="/make-me-move/">Make an offer &rarr;</a>
      ${mlsLink}
    </div>
  </div>
  <div class="disc">
    Listing data from MLSListings, refreshed twice daily. Eichler Market is operated by Tim McMullen, McMullen Properties (DRE #02016832), under Real Broker (DRE #02228473). Information deemed reliable but not guaranteed; buyers to verify all details. Not intended to solicit currently listed properties.
  </div>
</div>`;

  return new Response(
    shell(inner, `${p.address} · ${money(p.price)} · Eichler Market`, `${p.address} in ${p.city} — ${money(p.price)}. ${[p.beds && p.beds+' bed', p.baths && p.baths+' bath', p.sqft && Number(p.sqft).toLocaleString()+' sq ft'].filter(Boolean).join(', ')}. Active Eichler listing.`),
    { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public, max-age=300' } }
  );
}
