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
 *   2. Appends ?api_key=… to any unkeyed basemaps.cartocdn.com tile URL, so
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

/* Unkeyed CARTO raster tile URLs. The negative lookahead keeps this idempotent
   and stops it touching a URL that already carries a key. */
const TILE = /(https:\/\/\{s\}\.basemaps\.cartocdn\.com\/[a-z_\/]+\/\{z\}\/\{x\}\/\{y\}(?:\{r\})?\.png)(?!\?)/g;

export async function onRequest(context) {
  const res = await context.next();

  try {
    const key = context.env && context.env.CARTO_KEY;
    if (!key) return res;                       // unset: behave exactly as before

    const type = res.headers.get('content-type') || '';
    if (!type.includes('text/html')) return res; // assets stream through

    let html = await res.text();

    html = html.split(TOKEN).join(key);
    html = html.replace(TILE, (m, url) => url + '?api_key=' + encodeURIComponent(key));

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
