/* Eichler Market — Listings & Sold data helpers (DB-driven)
 * Reads public views v_eichler_active_listings + v_eichler_recent_sold.
 * Includes a community-link GUARD so uncovered slugs never dead-end.
 */
(function () {
  var SB_URL = 'https://kfqphwerygccpzntbbif.supabase.co';
  var SB_KEY = 'sb_publishable_cR53l68E0KtOpANRKiVi7Q_Vx57yQb0';

  // Community pages that actually exist in the build (the only slugs safe to link).
  var PAGES = [
  "19th-avenue-park",
  "atherton-eichlers",
  "atherwood",
  "bay-vista",
  "belmont-eichlers",
  "campbell-eichlers",
  "charleston-meadows",
  "cuernavaca",
  "cupertino-eichlers",
  "east-palo-alto-eichlers",
  "eichler-campbell",
  "eichler-cupertino",
  "eichler-gilroy",
  "eichler-los-altos-hills",
  "eichler-los-gatos",
  "eichler-milpitas",
  "eichler-monte-sereno",
  "eichler-morgan-hill",
  "eichler-mountain-view",
  "eichler-san-jose",
  "eichler-santa-clara",
  "eichler-saratoga",
  "eichler-stanford",
  "eichler-sunnyvale",
  "eichler-sunnyvale-vanderbilt-area",
  "el-granada-eichlers",
  "fairbrae",
  "fairglen",
  "fairwood",
  "fairwood-redwood-city",
  "foster-city-eichlers",
  "gilroy-eichlers",
  "green-gables",
  "greenmeadow",
  "hillsborough-eichlers",
  "ladera",
  "los-altos-eichlers",
  "los-altos-hills-eichlers",
  "los-gatos-eichlers",
  "marina-point",
  "maywood-park",
  "menlo-oaks",
  "menlo-park-eichlers",
  "millbrae-eichlers",
  "mills-estates",
  "milpitas-eichlers",
  "monte-sereno-eichlers",
  "morgan-hill-eichlers",
  "mountain-view-eichlers",
  "oakdell-park",
  "palo-alto-eichlers",
  "palo-alto-other-eichlers",
  "palo-verde",
  "rancho-verde",
  "redwood-city-eichlers",
  "roseglen",
  "san-bruno-eichlers",
  "san-carlos-eichlers",
  "san-jose-eichlers",
  "san-jose-other-eichlers",
  "san-mateo-highlands",
  "san-mateo-other-eichlers",
  "santa-clara-eichlers",
  "saratoga-eichlers",
  "sequoia-meadow",
  "shadygrove",
  "south-los-altos-eichlers",
  "stanford-eichlers",
  "stanford-gardens",
  "stanford-palo-alto-hills",
  "sunnyvale-eichlers",
  "sunnyvale-other-eichlers",
  "sunnyvale-vanderbilt-tract",
  "treasure-isle",
  "woodside-eichlers"
  ];
  var PAGE_SET = {};
  PAGES.forEach(function (s) { PAGE_SET[s] = 1; });

  // Aliases: DB slug -> existing page slug (covers fallback communities).
  var ALIAS = {
    'portola-valley-eichlers': 'ladera'
  };

  // Returns a safe community URL, or null if no page exists (caller renders plain text).
  function communityHref(slug) {
    if (!slug) return null;
    if (PAGE_SET[slug]) return '/community/' + slug + '/';
    if (ALIAS[slug] && PAGE_SET[ALIAS[slug]]) return '/community/' + ALIAS[slug] + '/';
    return null;
  }

  function api(path) {
    return fetch(SB_URL + '/rest/v1/' + path, {
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }
    }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }

  // POST to a Postgres RPC (returns [] on any failure so callers can degrade gracefully)
  function rpc(fn, params) {
    return fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params || {})
    }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  }

  function money(n) {
    if (n == null) return '';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2) + 'M';
    return '$' + Number(n).toLocaleString();
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function specLine(beds, baths, sqft) {
    var p = [];
    if (beds) p.push(beds + ' bd');
    if (baths) p.push(baths + ' ba');
    if (sqft) p.push(Number(sqft).toLocaleString() + ' sf');
    return p.join(' · ');
  }

  window.EMListings = {
    activeListings: function () { return api('v_eichler_active_listings?select=*'); },
    // Gallery view: same fields plus photos[] (re-hosted ordered gallery) and photo_count
    activeGallery: function () { return api('v_eichler_listing_gallery?select=*'); },
    activeCount: function () {
      return fetch(SB_URL + '/rest/v1/v_eichler_active_listings?select=mls_number', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, Prefer: 'count=exact', Range: '0-0' }
      }).then(function (r) {
        var cr = r.headers.get('content-range') || '';
        var m = cr.match(/\/(\d+)$/);
        return m ? +m[1] : 0;
      }).catch(function () { return 0; });
    },
    recentSold: function (days, limit) {
      var q = 'v_eichler_recent_sold?select=*&order=sale_date.desc&limit=' + (limit || 50);
      if (days) {
        var d = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
        q += '&sale_date=gte.' + d;
      }
      return api(q);
    },
    communityHref: communityHref,
    // Live sales feed (DB, day-dated, freshest first)
    recentSales: function (limit) { return rpc('eichler_recent_sales', { p_limit: limit || 12 }); },
    // Quarterly median $/sf trajectory (Eichler-wide)
    psfQuarterly: function (quarters) { return rpc('eichler_psf_quarterly', { p_quarters: quarters || 16 }); },
    money: money, esc: esc, specLine: specLine
  };
})();
