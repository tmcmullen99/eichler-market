/* Eichler Market — Lead submission helper (Resend-backed, via Supabase).
 * Replaces the old EmailJS client. Forms call window.EMLead.* which insert
 * into Supabase; database triggers send the branded email via Resend.
 *
 *   EMLead.submitOffer({ name, email, building_slug, unit_label, amount, message })
 *   EMLead.submitLead ({ email, intent, building_slug, unit_label, target_price, message })
 *
 * Both return a Promise that resolves on success and never throws to the caller
 * (forms show their own success UI; failures are logged, not surfaced loudly).
 */
(function () {
  var SB_URL = 'https://kfqphwerygccpzntbbif.supabase.co';
  var SB_KEY = 'sb_publishable_cR53l68E0KtOpANRKiVi7Q_Vx57yQb0';

  function rpc(fn, params) {
    return fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params || {})
    }).then(function (r) {
      return r.ok ? r.json() : r.text().then(function (t) { throw new Error(r.status + ' ' + t); });
    });
  }

  // Parse a currency-ish string ("$2,500,000", "2.5M", 2500000) to an integer.
  function toAmount(v) {
    if (v == null) return 0;
    if (typeof v === 'number') return Math.max(0, Math.round(v));
    var s = String(v).trim().toLowerCase().replace(/[$,\s]/g, '');
    var mult = 1;
    if (/m$/.test(s)) { mult = 1e6; s = s.replace(/m$/, ''); }
    else if (/k$/.test(s)) { mult = 1e3; s = s.replace(/k$/, ''); }
    var n = parseFloat(s);
    return isFinite(n) ? Math.max(0, Math.round(n * mult)) : 0;
  }

  window.EMLead = {
    // Buyer offer / LOI → offers table (Eichler market) → send-eichler-eoi
    submitOffer: function (o) {
      o = o || {};
      return rpc('submit_eichler_offer', {
        p_buyer_name:    o.name || '',
        p_buyer_email:   o.email || '',
        p_building_slug: o.building_slug || o.slug || 'eichler-direct',
        p_unit_label:    o.unit_label || o.unit || o.address || null,
        p_offer_amount:  toAmount(o.amount),
        p_message:       o.message || null
      }).catch(function (e) { try { console.warn('EMLead.submitOffer failed', e); } catch (_) {} });
    },
    // Make-Me-Move / soft owner lead → lead_captures table
    submitLead: function (o) {
      o = o || {};
      return rpc('submit_eichler_lead', {
        p_email:         o.email || '',
        p_intent:        o.intent || 'mmm_price',
        p_building_slug: o.building_slug || o.slug || null,
        p_unit_label:    o.unit_label || o.unit || o.address || null,
        p_target_price:  o.target_price != null ? toAmount(o.target_price) : null,
        p_message:       o.message || null
      }).catch(function (e) { try { console.warn('EMLead.submitLead failed', e); } catch (_) {} });
    },
    _toAmount: toAmount
  };

  /* 20 Oct 2026 — the community pages' VIP waitlist. Every one of the 75 pages called joinWaitlist()
     from its "Join waitlist →" button and none defined it, so the click did nothing and nothing was
     stored. The lead goes to lead_captures (intent 'interest', the community as the building slug, the
     first name in the message) and on to the desk through the inbound feed; the page then shows its
     own "You're on the list" panel. */
  function communitySlug() {
    var m = document.querySelector('meta[name="em-community-slug"]');
    if (m && m.content) return m.content;
    var p = (location.pathname.match(/^\/community\/([a-z0-9-]+)\/?/) || [])[1];
    return p || null;
  }
  window.joinWaitlist = function () {
    var nameEl = document.getElementById('vip-name');
    var emailEl = document.getElementById('vip-email');
    var email = emailEl ? String(emailEl.value || '').trim() : '';
    var name = nameEl ? String(nameEl.value || '').trim() : '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      if (emailEl) { emailEl.focus(); emailEl.style.outline = '2px solid #b4533a'; setTimeout(function () { emailEl.style.outline = ''; }, 1500); }
      return;
    }
    var btn = document.querySelector('#vip-form .vip-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
    var slug = communitySlug();
    var badge = document.querySelector('.vip-badge-txt');
    var label = (document.querySelector('meta[name="em-community"]') || {}).content
      || (badge && badge.textContent.indexOf('·') > -1 ? badge.textContent.split('·').pop().trim() : '')
      || slug || 'Eichler Market';
    window.EMLead.submitLead({
      email: email,
      intent: 'interest',
      building_slug: slug,
      message: 'VIP waitlist · ' + label + (name ? ' · ' + name : '')
    }).then(function () {
      // form_submit is on the site_events allowlist; a new event name would be dropped silently.
      try { if (window.cmTrack) window.cmTrack('form_submit', { form: 'vip_waitlist', community: slug }); } catch (_) {}
      var form = document.getElementById('vip-form'), thanks = document.getElementById('vip-thanks');
      if (form) form.style.display = 'none';
      if (thanks) { thanks.style.display = 'block'; thanks.classList.add('show'); }
      if (btn) { btn.disabled = false; btn.textContent = 'Join waitlist →'; }
    });
  };
})();
