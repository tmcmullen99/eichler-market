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
})();
