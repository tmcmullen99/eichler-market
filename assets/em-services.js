/* Eichler Market — Service Directory (area-matched, DB-driven)
 * Renders into <section id="em-services-root" data-city="..." data-county="..."> on community pages.
 * Vendors live in Supabase service_pros; matched via home_service_pros(city, county) RPC:
 *   city match   -> shown first  (a pro who lists this exact city)
 *   county match -> shown next   (a pro who serves the whole county)
 *   'all'        -> always shown  (McMullen Properties, Bayside Pavers)
 * A Berkeley pro never appears on a Palo Alto page — areas must overlap.
 * Placeholder rows (name "Your business here") render as dashed "claim this category" cards.
 */
(function () {
  var SB_URL = 'https://kfqphwerygccpzntbbif.supabase.co';
  var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmcXBod2VyeWdjY3B6bnRiYmlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzOTgxODQsImV4cCI6MjA5MTk3NDE4NH0.FGQD3BMLVLD9lE8LUBUjD3SqKhsCxjdnCiGV8MMnqpg';

  var root = document.getElementById('em-services-root');
  if (!root) return;
  var city = root.getAttribute('data-city') || '';
  var county = root.getAttribute('data-county') || '';

  var css = ''
    + '#em-services-root{background:#0e1118;padding:64px 24px}'
    + '.svc-wrap{max-width:1080px;margin:0 auto}'
    + '.svc-ey{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(200,169,110,.7);margin-bottom:10px}'
    + '.svc-title{font-family:"Playfair Display",serif;font-size:clamp(26px,3.5vw,38px);font-weight:500;color:#fff;margin:0 0 8px}'
    + '.svc-sub{font-size:14px;color:rgba(232,227,216,.55);font-weight:300;margin-bottom:34px;max-width:640px;line-height:1.6}'
    + '.svc-cat{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(145,161,186,.6);margin:26px 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(232,227,216,.08)}'
    + '.svc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}'
    + '.svc-card{background:#141826;border:1px solid rgba(232,227,216,.08);border-radius:10px;padding:18px 20px;position:relative}'
    + '.svc-name{font-family:"Playfair Display",serif;font-size:17px;color:#fff;margin-bottom:5px}'
    + '.svc-blurb{font-size:13px;color:rgba(232,227,216,.65);line-height:1.55;margin-bottom:12px;font-weight:300}'
    + '.svc-links a{font-size:12px;color:#c8a96e;text-decoration:none;margin-right:14px}'
    + '.svc-links a:hover{text-decoration:underline}'
    + '.svc-spons{position:absolute;top:12px;right:14px;font-family:"JetBrains Mono",monospace;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(200,169,110,.55)}'
    + '.svc-area{position:absolute;top:12px;right:14px;font-family:"JetBrains Mono",monospace;font-size:8px;letter-spacing:.1em;text-transform:uppercase;color:rgba(145,161,186,.4)}'
    + '.svc-card.svc-open{background:transparent;border:1px dashed rgba(200,169,110,.28)}'
    + '.svc-open .svc-name{color:rgba(232,227,216,.5);font-style:italic;font-size:15px}'
    + '.svc-open .svc-claim{font-size:12px;color:#c8a96e;text-decoration:none;font-weight:600}'
    + '.svc-open .svc-claim:hover{text-decoration:underline}'
    + '.svc-cta{margin-top:36px;padding:22px 24px;border:1px dashed rgba(200,169,110,.35);border-radius:10px;text-align:center}'
    + '.svc-cta-t{font-size:14px;color:rgba(232,227,216,.75);margin-bottom:4px}'
    + '.svc-cta a{color:#c8a96e;text-decoration:none;font-weight:600}'
    + '.svc-cta a:hover{text-decoration:underline}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var loc = city || county || 'the Bay Area';

  fetch(SB_URL + '/rest/v1/rpc/home_service_pros', {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_city: city, p_county: county })
  })
  .then(function (r) { return r.json(); })
  .then(function (rows) {
    if (!Array.isArray(rows) || !rows.length) return;

    var order = [], cats = {};
    rows.forEach(function (p) {
      if (!cats[p.category]) { cats[p.category] = []; order.push(p.category); }
      cats[p.category].push(p);
    });

    var h = '<div class="svc-wrap">'
      + '<div class="svc-ey">Service Directory</div>'
      + '<h2 class="svc-title">Eichler pros serving ' + esc(loc) + '</h2>'
      + '<div class="svc-sub">Radiant heat, flat foam roofs, original siding, glass walls &mdash; Eichlers need people who know Eichlers. Everyone listed here serves '
      + esc(city ? city + ' and the surrounding ' + (county ? county + ' County' : 'area') : (county ? county + ' County' : 'this area')) + '.</div>';

    order.forEach(function (cat) {
      h += '<div class="svc-cat">' + esc(cat) + '</div><div class="svc-grid">';
      cats[cat].forEach(function (p) {
        var isOpen = (p.name === 'Your business here');
        if (isOpen) {
          h += '<div class="svc-card svc-open">'
            + '<div class="svc-name">Your business here</div>'
            + (p.blurb ? '<div class="svc-blurb">' + esc(p.blurb) + '</div>' : '')
            + '<a class="svc-claim" href="mailto:tim@eichlermarket.com?subject='
            + encodeURIComponent('List my business - ' + cat + ' (' + loc + ')')
            + '&body=' + encodeURIComponent('Company name:\nWhat you do:\nWhy you are great with Eichlers:\nPhone / website:\nCities you serve:')
            + '" data-cm-cta="svc-claim">Add your business &rarr;</a>'
            + '</div>';
        } else {
          var areaTag = p.match_level === 3 ? esc(city)
            : p.match_level === 2 ? esc(county ? county + ' Co.' : '') : '';
          h += '<div class="svc-card">'
            + (p.sponsored ? '<span class="svc-spons">Featured</span>'
                : (areaTag ? '<span class="svc-area">' + areaTag + '</span>' : ''))
            + '<div class="svc-name">' + esc(p.name) + '</div>'
            + (p.blurb ? '<div class="svc-blurb">' + esc(p.blurb) + '</div>' : '')
            + '<div class="svc-links">'
            + (p.website ? '<a href="' + esc(p.website) + '" target="_blank" rel="noopener" data-cm-cta="svc-web-' + slug(p.name) + '">Website &rarr;</a>' : '')
            + (p.phone ? '<a href="tel:' + esc(p.phone) + '" data-cm-cta="svc-tel-' + slug(p.name) + '">' + esc(p.phone) + '</a>' : '')
            + (p.email ? '<a href="mailto:' + esc(p.email) + '">Email</a>' : '')
            + '</div></div>';
        }
      });
      h += '</div>';
    });

    h += '<div class="svc-cta">'
      + '<div class="svc-cta-t">Know a contractor who actually understands Eichlers?</div>'
      + '<a href="mailto:tim@eichlermarket.com?subject=' + encodeURIComponent('Service Pro Recommendation - ' + loc) + '&body=' + encodeURIComponent('Company name:\nWhat they do:\nWhy they are great with Eichlers:\nTheir phone/website:') + '" data-cm-cta="svc-recommend">Recommend them &rarr;</a>'
      + ' &nbsp;&middot;&nbsp; <a href="mailto:tim@eichlermarket.com?subject=' + encodeURIComponent('List my company on Eichler Market - ' + loc) + '" data-cm-cta="svc-vendor-signup">Are you a pro? Get listed &rarr;</a>'
      + '</div></div>';

    root.innerHTML = h;
  })
  .catch(function () { /* fail silent */ });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
})();
