/**
 * em-supabase.js — Eichler Market · Marketplace Integration Layer
 * Exposes window.EM with full auth, DB, notification, and UI helpers.
 *
 * SETUP: Replace the two constants below with your Supabase project values.
 * Dashboard → Settings → API
 */

const SUPABASE_URL      = 'https://kfqphwerygccpzntbbif.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cR53l68E0KtOpANRKiVi7Q_Vx57yQb0';

// EmailJS (existing credentials + new template IDs)
const EJ = {
  svc:              'service_733sibl',
  key:              'rjIXPckMwcWAXnyPx',
  t_offer_to_tim:   'template_dqt85kb',   // existing — offer to Tim
  t_mms_to_tim:     'template_vu9b3uo',   // existing — MMS to Tim
  t_buyer_confirm:  'template_0ooql52',   // existing — buyer confirmation
  t_offer_to_owner: 'template_offer_to_owner',  // NEW — notify homeowner
  t_welcome:        'template_welcome',          // NEW — welcome email
};

// ── Init ──────────────────────────────────────────────────────────────────

window.EM = (function () {
  'use strict';

  let _sb = null;
  let _user = null;
  let _profile = null;

  // Lazy-init Supabase client (waits for CDN to load)
  function getSB() {
    if (!_sb) {
      const lib = window.supabase || window.Supabase;
      if (!lib) throw new Error('[EM] Supabase CDN not loaded');
      _sb = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return _sb;
  }

  // ── Auth ────────────────────────────────────────────────────────────────

  async function init() {
    try {
      const sb = getSB();
      const { data: { user } } = await sb.auth.getUser();
      _user = user;
      if (_user) await _loadProfile();
      _updateNav();

      // Auth state changes
      sb.auth.onAuthStateChange(async (event, session) => {
        _user = session?.user || null;
        if (_user) await _loadProfile();
        else _profile = null;
        _updateNav();
        // Dispatch so pages can react
        document.dispatchEvent(new CustomEvent('em:auth', { detail: { user: _user, profile: _profile } }));
      });
    } catch (e) {
      console.warn('[EM] init error:', e.message);
    }
  }

  async function signUp(email, password, fullName, phone) {
    const sb = getSB();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
    if (error) throw error;

    // Update profile with name and phone
    if (data.user) {
      await sb.from('profiles')
        .update({ full_name: fullName, phone: phone || null })
        .eq('id', data.user.id);

      // Welcome email
      _ejSend(EJ.t_welcome, {
        to_email:   email,
        user_name:  fullName || email.split('@')[0],
      });
    }
    return data;
  }

  async function signIn(email, password) {
    const sb = getSB();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await getSB().auth.signOut();
    _user = null;
    _profile = null;
    _updateNav();
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  async function _loadProfile() {
    if (!_user) return;
    const { data } = await getSB()
      .from('profiles')
      .select('*')
      .eq('id', _user.id)
      .single();
    _profile = data;
    return _profile;
  }

  async function getProfile() {
    if (!_user) return null;
    await _loadProfile();
    return _profile;
  }

  async function updateProfile(updates) {
    if (!_user) throw new Error('Not authenticated');
    const { data, error } = await getSB()
      .from('profiles')
      .update(updates)
      .eq('id', _user.id)
      .select()
      .single();
    if (error) throw error;
    _profile = data;
    _updateNav();
    return data;
  }

  // ── Listings ─────────────────────────────────────────────────────────────

  async function setMakeMyMove(opts) {
    // opts: { address, city, community, beds, baths, sqft, price, notes }
    if (!_user) return null;
    const sb = getSB();

    // Upsert: one listing per address per user
    const existing = await sb.from('listings')
      .select('id')
      .eq('user_id', _user.id)
      .eq('address', opts.address)
      .maybeSingle();

    let result;
    if (existing.data?.id) {
      result = await sb.from('listings')
        .update({ price: opts.price, status: 'active', notes: opts.notes || null, updated_at: new Date().toISOString() })
        .eq('id', existing.data.id)
        .select().single();
    } else {
      result = await sb.from('listings')
        .insert({
          user_id:   _user.id,
          address:   opts.address,
          city:      opts.city || '',
          community: opts.community || null,
          beds:      opts.beds || null,
          baths:     opts.baths || null,
          sqft:      opts.sqft || null,
          price:     opts.price,
          notes:     opts.notes || null,
        })
        .select().single();
    }
    if (result.error) throw result.error;

    // ── Email notifications ────────────────────────────────────────────────
    const listing = result.data;
    const ppsf = opts.sqft ? Math.round(opts.price / opts.sqft) : null;
    const fmtP = '$' + Number(opts.price).toLocaleString();
    const fmtPpsf = ppsf ? '$' + ppsf.toLocaleString() + '/sf' : '';
    _ejSend(EJ.t_mms_to_tim, {
      to_email:'tim@mcmullen.properties', to_name:'Tim',
      owner_name: (_profile && _profile.full_name) || _user.email,
      owner_email: _user.email,
      address: opts.address, city: opts.city || '',
      community: opts.community || '', beds: opts.beds || '',
      baths: opts.baths || '', sqft: opts.sqft || '',
      price: fmtP, ppsf: fmtPpsf, notes: opts.notes || '',
      subject: 'New Make Me Move: ' + opts.address + ' — ' + fmtP,
    });
    _ejSend(EJ.t_welcome, {
      to_email: _user.email,
      to_name: (_profile && _profile.full_name) || 'Homeowner',
      address: opts.address, city: opts.city || '',
      price: fmtP, ppsf: fmtPpsf,
      subject: 'Your Make Me Move price is live — ' + opts.address,
    });
    return listing;
  }

  async function addNewProperty(opts) {
    // For homes not in the dataset — user-submitted listings
    if (!_user) throw new Error('Must be signed in to add a property');
    const { data, error } = await getSB().from('listings').insert({
      user_id:        _user.id,
      address:        opts.address,
      city:           opts.city,
      community:      opts.community || null,
      beds:           opts.beds,
      baths:          opts.baths,
      sqft:           opts.sqft,
      price:          opts.price,
      notes:          opts.notes || null,
      photo_url:      opts.photo_url || null,
      is_new_listing: true,
    }).select().single();
    if (error) throw error;
    return data;
  }

  async function updateListing(id, updates) {
    if (!_user) throw new Error('Not authenticated');
    const { data, error } = await getSB()
      .from('listings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', _user.id) // RLS guard
      .select().single();
    if (error) throw error;
    return data;
  }

  async function removeListing(id) {
    if (!_user) throw new Error('Not authenticated');
    const { error } = await getSB()
      .from('listings')
      .update({ status: 'removed' })
      .eq('id', id)
      .eq('user_id', _user.id);
    if (error) throw error;
  }

  async function getMyListings() {
    if (!_user) return [];
    const { data } = await getSB()
      .from('listings')
      .select('*')
      .eq('user_id', _user.id)
      .neq('status', 'removed')
      .order('created_at', { ascending: false });
    return data || [];
  }

  async function getPublicListings() {
    const { data } = await getSB()
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    return data || [];
  }

  // ── Offers ───────────────────────────────────────────────────────────────

  async function submitOffer(buyerName, buyerEmail, address, message) {
    const sb = getSB();

    // Try to find the listing and its owner
    const { data: listing } = await sb.from('listings')
      .select('id, user_id')
      .eq('address', address)
      .eq('status', 'active')
      .maybeSingle();

    const { data, error } = await sb.rpc('submit_offer', {
      p_buyer_name:     buyerName,
      p_buyer_email:    buyerEmail,
      p_address:        address,
      p_buyer_user_id:  _user?.id || null,
      p_listing_id:     listing?.id || null,
      p_target_user_id: listing?.user_id || null,
      p_message:        message || null,
    });
    if (error) throw error;

    // Notify homeowner via email if they have a listing
    if (listing?.user_id) {
      const { data: ownerProfile } = await sb.from('profiles')
        .select('email, full_name')
        .eq('id', listing.user_id)
        .single();
      if (ownerProfile) {
        _ejSend(EJ.t_offer_to_owner, {
          to_email:    ownerProfile.email,
          owner_name:  ownerProfile.full_name || 'Homeowner',
          buyer_name:  buyerName,
          buyer_email: buyerEmail,
          address:     address,
          tim_email:   'tim@mcmullen.properties',
        });
      }
    }
    return data;
  }

  async function getMyOffers() {
    if (!_user) return [];
    const { data } = await getSB()
      .from('offers')
      .select('*')
      .eq('target_user_id', _user.id)
      .order('created_at', { ascending: false });
    return data || [];
  }

  async function markOfferViewed(offerId) {
    if (!_user) return;
    await getSB().from('offers')
      .update({ status: 'viewed' })
      .eq('id', offerId)
      .eq('target_user_id', _user.id);
  }

  // ── Notifications ────────────────────────────────────────────────────────

  async function getNotifications(unreadOnly) {
    if (!_user) return [];
    const q = getSB().from('notifications')
      .select('*')
      .eq('user_id', _user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (unreadOnly) q.eq('read', false);
    const { data } = await q;
    return data || [];
  }

  async function markAllRead() {
    if (!_user) return;
    await getSB().from('notifications')
      .update({ read: true })
      .eq('user_id', _user.id)
      .eq('read', false);
    _updateNavBadge(0);
  }

  async function markRead(id) {
    if (!_user) return;
    await getSB().from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', _user.id);
  }

  async function _getUnreadCount() {
    if (!_user) return 0;
    const { count } = await getSB().from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', _user.id)
      .eq('read', false);
    return count || 0;
  }

  // ── Email helpers ────────────────────────────────────────────────────────

  function _ejSend(templateId, params) {
    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id:      EJ.svc,
        template_id:     templateId,
        user_id:         EJ.key,
        template_params: { ...params, to_email: params.to_email || 'tim@mcmullen.properties' },
      }),
    }).catch(() => {});
  }

  // ── Nav UI ───────────────────────────────────────────────────────────────

  function _updateNav() {
    const containers = document.querySelectorAll('.em-auth-nav, #em-auth-nav');
    if (!containers.length) return;

    if (_user && _profile) {
      const initials = (_profile.full_name || _profile.email || '?')
        .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

      containers.forEach(el => {
        el.innerHTML = `
          <a href="/dashboard/" class="em-nav-user" title="Dashboard">
            <span class="em-nav-avatar">${initials}</span>
            <span class="em-nav-name">${_profile.full_name || _profile.email.split('@')[0]}</span>
          </a>
          <a href="/dashboard/#notifications" class="em-nav-bell" id="em-notif-btn" title="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="em-nav-badge" id="em-notif-badge" style="display:none">0</span>
          </a>`;
      });

      // Load unread count async
      _getUnreadCount().then(n => _updateNavBadge(n));
    } else {
      containers.forEach(el => {
        el.innerHTML = `
          <a href="/auth/" class="em-nav-signin">Sign in</a>`;
      });
    }
  }

  function _updateNavBadge(count) {
    const badge = document.getElementById('em-notif-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ── Monkey-patch existing modal flows ──────────────────────────────────
  // Hooks into cmSO (MMS submit) and cmSB (offer submit) so existing pages
  // persist to Supabase without requiring page-level modifications.

  function _patchExistingFlows() {
    // Wait for DOM fully ready
    const patch = () => {
      // Patch Make Me Move submission
      if (typeof window.cmSO === 'function' && !window.cmSO._patched) {
        const orig = window.cmSO;
        window.cmSO = async function () {
          orig.call(this);
          if (window.S && window.S.ow) {
            try {
              await EM.setMakeMyMove({
                address: window.S.ow.u,
                city:    document.querySelector('meta[name="em-city"]')?.content || '',
                community: document.querySelector('meta[name="em-community"]')?.content || '',
                beds:    null,
                baths:   null,
                sqft:    null,
                price:   parseInt((window.S.ow.p || '').replace(/\D/g, '')) || 0,
                notes:   null,
              });
            } catch (e) { console.warn('[EM] MMS save error', e); }
          }
        };
        window.cmSO._patched = true;
      }

      // Patch offer submission
      if (typeof window.cmSB === 'function' && !window.cmSB._patched) {
        const orig = window.cmSB;
        window.cmSB = async function () {
          orig.call(this);
          if (window.S && window.S.su && window.S.by) {
            try {
              await EM.submitOffer(
                window.S.by.n,
                window.S.by.e,
                window.S.su.unit,
                null
              );
            } catch (e) { console.warn('[EM] Offer save error', e); }
          }
        };
        window.cmSB._patched = true;
      }
    };

    if (document.readyState === 'complete') patch();
    else window.addEventListener('load', patch);
  }

  // ── Auth guard ───────────────────────────────────────────────────────────

  function requireAuth(redirectPath) {
    if (!_user) {
      const dest = redirectPath || window.location.pathname;
      window.location.href = '/auth/?next=' + encodeURIComponent(dest);
      return false;
    }
    return true;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  const EM = {
    // State
    get user()    { return _user;    },
    get profile() { return _profile; },
    get isAuth()  { return !!_user;  },

    // Core
    init,
    signUp,
    signIn,
    signOut,
    requireAuth,

    // Profile
    getProfile,
    updateProfile,

    // Listings
    setMakeMyMove,
    addNewProperty,
    updateListing,
    removeListing,
    getMyListings,
    getPublicListings,

    // Offers
    submitOffer,
    getMyOffers,
    markOfferViewed,

    // Notifications
    getNotifications,
    markAllRead,
    markRead,

    // Internal (exposed for testing)
    _ejSend,
    _patchExistingFlows,
  };

  // Auto-patch on load
  _patchExistingFlows();

  return EM;
})();

// Auto-init
EM.init().catch(e => console.warn('[EM] Auto-init failed:', e.message));
