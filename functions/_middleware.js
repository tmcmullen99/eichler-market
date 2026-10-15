/**
 * functions/_middleware.js — the response seam this site did not have.
 *
 * WHY THIS EXISTS
 *
 * 78 pages hardcode an unkeyed CARTO tile URL, so every map on the site draws
 * "API KEY REQUIRED" diagonally across the tiles. The obvious fix — paste the
 * key into 78 files — puts a credential in the repo and guarantees that the
 * 79th map, added later, misses it.
 *
 * The city and condo platforms solve this with a single substitution seam in
 * their worker: the HTML carries a __CARTO_KEY__ token and the worker swaps in
 * an environment variable on the way out. eichler-market has no worker, so it
 * had no seam. This is that seam, built the only way a static Pages site can
 * build one.
 *
 * WHAT IT DOES
 *
 *   1. Replaces the literal token __CARTO_KEY__ anywhere in an HTML response.
 *   2. Appends ?key=… to any unkeyed basemaps.cartocdn.com tile URL, so
 *      the 78 existing pages are fixed without touching one of them, and a
 *      page added tomorrow is fixed whether or not its author knew about this.
 *   3. Injects <meta name="carto-key"> so scripts under /assets/*.js can read
 *      the key from the DOM. Those files are served as application/javascript
 *      and are never rewritten — the same reason the condo platform carries
 *      the key in a meta tag rather than substituting into its JS.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 *   - Nothing happens to non-HTML responses. Assets stream through untouched.
 *   - With CARTO_KEY unset it is a no-op: pages render exactly as they do
 *     today, watermark and all. A missing variable must not blank the site.
 *   - Any failure returns the original response. A map watermark is a blemish;
 *     a middleware exception is a 500 on every page.
 *
 * REQUIRES
 *   - CARTO_KEY set on the Pages project (Production and Preview).
 *   - _routes.json widened past /listing/* or this never runs. That was the
 *     trap: Functions only execute on included routes, so a middleware added
 *     without that change would have been invisible on all 78 map pages.
 */

const TOKEN = '__CARTO_KEY__';

/* Street View fallback.

   1,154 of the 1,701 Eichler homes have a real photo in assets/photos. The
   other ~550 render an empty grey div today. The city platform already solves
   this — photoUrl() in the Campbell worker returns the MLS photo when there is
   one and a Street View Static image when there is not — and this is the same
   rule for the same reason.

   MLS PHOTO ALWAYS WINS. Street View is strictly the fallback, never a
   replacement. Eichlers turn inward: atrium in the middle, glass to the rear,
   and a deliberately blank or fenced street elevation. Street View of an
   Eichler is frequently a fence and a garage door, which is worse than the
   real photo for any home that has one.

   Nothing is cached or stored. Google's Street View policies prohibit
   pre-fetching, indexing, storing or caching the imagery, so the URL is built
   at render time and the browser fetches it live from Google — exactly what
   the city worker does. Only the key is injected.

   The <img onerror> handlers already on every call site do the rest: an
   address with no Street View coverage returns a "no imagery" placeholder,
   which fails the onerror check and hides itself. No grey boxes. */
const GMAPS_TOKEN = '__GMAPS_KEY__';

const PHOTO_HELPER =
  '<script id="em-photo">window.emPhoto=function(p){' +
  'if(!p)return "";' +
  'if(p.img)return p.img;' +                       // repo photo always wins
  'var m=document.querySelector(\'meta[name="gmaps-key"]\');' +
  'var k=(m&&m.content&&m.content.indexOf("__")!==0)?m.content:"";' +
  'if(!k)return "";' +                             // no key: behave as before
  'var loc=p.lat&&p.lng?(p.lat+","+p.lng):((p.a||"")+", "+(p.c||"")+", CA");' +
  'if(!p.lat&&!p.a)return "";' +
  'return "https://maps.googleapis.com/maps/api/streetview?size=640x400&location="' +
  '+encodeURIComponent(loc)+"&fov=72&pitch=0&source=outdoor&key="+encodeURIComponent(k);' +
  '};' +
  /* MLS photo rescue.
     Active listings carry photo_url straight from the portal:
     search.mlslistings.com/MediaServer/GetMedia.ashx?Key=... Those are
     portal-session URLs. MLSListings does not serve them to third-party
     sites, so every one renders as a broken-image icon — which is what the
     active-listings grid was showing.
     Until the photos are rehosted onto our own storage, this catches the
     failure and swaps in Street View. Marked on the element so a Street View
     miss cannot loop back into another error. */
  'window.emSvSwap=function(img){' +
  'if(!img||img.getAttribute("data-sv"))return void(img.style.visibility="hidden");' +
  'img.setAttribute("data-sv","1");' +
  'var m=document.querySelector(\'meta[name="gmaps-key"]\');' +
  'var k=(m&&m.content&&m.content.indexOf("__")!==0)?m.content:"";' +
  'var a=img.getAttribute("data-a")||"",c=img.getAttribute("data-c")||"";' +
  'if(!k||!a)return void(img.style.visibility="hidden");' +
  'img.src="https://maps.googleapis.com/maps/api/streetview?size=640x400&location="' +
  '+encodeURIComponent(a+", "+c+", CA")+"&fov=72&pitch=0&source=outdoor&key="+encodeURIComponent(k);' +
  '};<\/script>';

/* Unkeyed CARTO raster tile URLs. The negative lookahead keeps this idempotent
   and stops it touching a URL that already carries a key. */
const TILE = /(https:\/\/\{s\}\.basemaps\.cartocdn\.com\/[a-z_\/]+\/\{z\}\/\{x\}\/\{y\}(?:\{r\})?\.png)(?!\?)/g;

/* ONE HOST, ONE URL PER PAGE (SEO audit S27/S13/S28/S29, 15 Oct 2026).

   eichlermarket.com (the apex) is the canonical host: the sitemap, the news
   pages and every published link already use it. www.eichlermarket.com
   answered 200 with the same pages, so every page existed twice with no
   canonical. Now:
     - www → apex, 301, path and query kept;
     - retired URLs (the credit pages, the stale /communities/ copy of the home
       page, duplicate community pages) → 301 to the page that replaced them;
     - every HTML page without its own <link rel="canonical"> gets one, on the
       apex, in the trailing-slash form the sitemap uses;
     - *.pages.dev (preview and project hosts) answer X-Robots-Tag: noindex. */
const APEX = 'eichlermarket.com';
const ORIGIN = 'https://' + APEX;

/* Retired path (no trailing slash) → where it lives now. Published news URLs
   never appear here: they do not change. */
const MOVED = {
  '/save-10k': '/make-me-move/',          // credit offer withdrawn from public pages (Oct 2026)
  '/refer': '/auth/?tab=signup',          // same: the page was the credit pitch; accounts are made at /auth/
  '/communities': '/',                    // a stale copy of the home page (1,298 homes, July data)
  '/community/pomeroy-west': '/community/maywood-park/', // linked from 60 sale reports; Maywood Park covers Pomeroy West
};

function movedTarget(pathname) {
  let p = pathname.replace(/\/index\.html$/i, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return Object.prototype.hasOwnProperty.call(MOVED, p) ? MOVED[p] : null;
}

/* The canonical form of a path: directory pages end in "/", files keep their
   name. /homes/ is one page per home through ?p=<slug>, so that one
   parameter is kept; every other query (utm, ref, fbclid) is dropped. */
function canonicalUrl(url) {
  let p = url.pathname.replace(/\/index\.html$/i, '/');
  if (!/\.[a-z0-9]+$/i.test(p) && !p.endsWith('/')) p += '/';
  if (p === '/homes/') {
    const slug = url.searchParams.get('p');
    if (slug && /^[a-z0-9-]+$/.test(slug)) return ORIGIN + p + '?p=' + slug;
  }
  return ORIGIN + p;
}

function addCanonical(html, url) {
  if (/<link[^>]+rel=["']?canonical/i.test(html)) return html;     // page already says
  if (/<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html)) return html;
  const tag = '<link rel="canonical" href="' + canonicalUrl(url).replace(/"/g, '&quot;') + '">';
  if (/<\/title>/i.test(html)) return html.replace(/<\/title>/i, '</title>\n' + tag);
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, '<head$1>' + tag);
  return html;
}

/* App shells. /r/<code> (referral and mailer links), /auth/<anything> and
   /dashboard/<anything> are one page each that reads the path in the browser.
   _redirects rewrites never run on this project (Functions handle every route,
   and Pages does not apply _redirects to Function-served requests), so these
   used to fall through to the home page. Served here instead. */
function appShell(pathname) {
  for (const base of ['/r/', '/auth/', '/dashboard/']) {
    if (pathname.startsWith(base) && pathname.length > base.length) return base;
  }
  return null;
}

function redirect(location, status) {
  return new Response(null, { status: status || 301, headers: { Location: location, 'Cache-Control': 'public, max-age=3600' } });
}

function withRobots(res, host) {
  if (!host.endsWith('.pages.dev')) return res;
  const h = new Headers(res.headers);
  h.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function addNewsNav(html) {
  if (html.indexOf('class="nav-link" href="/news/"') === -1 && html.indexOf('href="/news/" class="nav-link"') === -1) {
    html = html.replace(/(<a href="\/make-me-move\/" class="nav-link"[^>]*>Make Me Move<\/a>)/,
      '$1\n    <a href="/news/" class="nav-link" style="text-decoration:none">Local news</a>');
  }
  if (html.indexOf('nav-drawer-item" href="/news/"') === -1) {
    html = html.replace(/(\+'<a class="nav-drawer-item" href="\/make-me-move\/">Make Me Move<\/a>')/,
      "$1\n      +'<a class=\"nav-drawer-item\" href=\"/news/\">Local news</a>'");
  }
  if (html.indexOf('<li><a href="/news/">') === -1) {
    html = html.replace(/(<li><a href="\/make-me-move\/">Make-Me-Move<\/a><\/li>)/, '$1<li><a href="/news/">Local news</a></li>');
  }
  return html;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname.toLowerCase();
  const method = context.request.method;

  if (method === 'GET' || method === 'HEAD') {
    if (host === 'www.' + APEX) return redirect(ORIGIN + url.pathname + url.search);
    const moved = movedTarget(url.pathname);
    if (moved) return withRobots(redirect(moved.indexOf('?') === -1 ? moved + url.search : moved), host);
  }

  return withRobots(await render(context, url), host);
}

async function render(context, url) {
  const shell = appShell(url.pathname);
  const res = (shell && context.env && context.env.ASSETS)
    ? await context.env.ASSETS.fetch(new URL(shell, url.origin))
    : await context.next();

  try {
    const key = context.env && context.env.CARTO_KEY;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return res; // assets stream through

    let html = await res.text();
    if (res.status === 200) html = addCanonical(html, shell ? new URL(shell, url.origin) : url);

    /* LOCAL NEWS in the menus (Tim, 25 Sep 2026). The header, the mobile drawer
       and the footer list are repeated in ~100 static pages; one seam here puts
       the link in all of them. Each insert is guarded, so a page that already
       links /news/ in that spot is left alone. */
    html = addNewsNav(html);

    if (!key) {                                  // no CARTO key: only the nav changed
      const h0 = new Headers(res.headers); h0.delete('content-length');
      return new Response(html, { status: res.status, statusText: res.statusText, headers: h0 });
    }

    html = html.split(TOKEN).join(key);

    const gkey = context.env && context.env.GMAPS_KEY;
    if (gkey) {
      html = html.split(GMAPS_TOKEN).join(gkey);
      if (html.indexOf('name="gmaps-key"') === -1 && /<head[^>]*>/i.test(html)) {
        html = html.replace(/<head([^>]*)>/i,
          '<head$1><meta name="gmaps-key" content="' + gkey.replace(/"/g, '&quot;') + '">');
      }
      if (html.indexOf('id="em-photo"') === -1 && /<\/head>/i.test(html)) {
        html = html.replace(/<\/head>/i, PHOTO_HELPER + '</head>');
      }
    }
    /* CARTO reads ?key=, not ?api_key= -- an api_key tile is served watermarked
       "API KEY REQUIRED" exactly as if no key were sent (fixed 25 Sep 2026). */
    html = html.replace(TILE, (m, url) => url + '?key=' + encodeURIComponent(key));

    /* One meta tag, for scripts that build tile URLs at runtime. Guarded so a
       page that already declares it is left alone. */
    if (html.indexOf('name="carto-key"') === -1 && /<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i,
        '<head$1><meta name="carto-key" content="' + key.replace(/"/g, '&quot;') + '">');
    }

    const headers = new Headers(res.headers);
    headers.delete('content-length');           // body length changed
    return new Response(html, { status: res.status, statusText: res.statusText, headers });
  } catch (e) {
    return res;                                 // never let this break a page
  }
}
