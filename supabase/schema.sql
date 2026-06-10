-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  EICHLER MARKET — SUPABASE SCHEMA                               ║
-- ║  Run this entire file in: Supabase → SQL Editor → New Query     ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLES ──────────────────────────────────────────────────────────

-- User profiles (extends auth.users, auto-created on signup via trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email         TEXT        NOT NULL,
  full_name     TEXT,
  phone         TEXT,
  refer_code    TEXT        UNIQUE NOT NULL DEFAULT '',
  points        INTEGER     NOT NULL DEFAULT 0,
  referrals_count INTEGER   NOT NULL DEFAULT 0,
  referred_by   TEXT,       -- refer_code of who referred them
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Make Me Move listings (homeowner sets a price on their home)
CREATE TABLE IF NOT EXISTS public.listings (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  address       TEXT        NOT NULL,
  city          TEXT        NOT NULL,
  community     TEXT,
  beds          INTEGER,
  baths         NUMERIC(3,1),
  sqft          INTEGER,
  price         INTEGER     NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused','sold','removed')),
  notes         TEXT,
  photo_url     TEXT,
  is_new_listing BOOLEAN    NOT NULL DEFAULT FALSE, -- true = user-added, not in dataset
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Buyer offers submitted on any property
CREATE TABLE IF NOT EXISTS public.offers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id   UUID        REFERENCES public.profiles ON DELETE SET NULL,
  buyer_name      TEXT        NOT NULL,
  buyer_email     TEXT        NOT NULL,
  target_address  TEXT        NOT NULL,
  target_listing_id UUID      REFERENCES public.listings ON DELETE SET NULL,
  target_user_id  UUID        REFERENCES public.profiles ON DELETE SET NULL,
  message         TEXT,
  referred_by     TEXT,       -- refer_code used by this buyer
  status          TEXT        NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new','viewed','responded','closed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referral tracking
CREATE TABLE IF NOT EXISTS public.referrals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     UUID        NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  referrer_code   TEXT        NOT NULL,
  referred_email  TEXT,
  referred_user_id UUID       REFERENCES public.profiles ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'signed_up'
                    CHECK (status IN ('signed_up','offer_submitted','closed')),
  points_awarded  INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- In-app notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles ON DELETE CASCADE,
  type        TEXT        NOT NULL,
  title       TEXT        NOT NULL,
  body        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT FALSE,
  data        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ── FUNCTIONS ──────────────────────────────────────────────────────

-- Generate a unique EM referral code
CREATE OR REPLACE FUNCTION generate_refer_code()
RETURNS TEXT LANGUAGE SQL AS $$
  SELECT 'EM' || UPPER(SUBSTR(MD5(gen_random_uuid()::text), 1, 6));
$$;

-- Auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, refer_code)
  VALUES (NEW.id, NEW.email, generate_refer_code())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Submit offer + notify homeowner + log referral offer
CREATE OR REPLACE FUNCTION submit_offer(
  p_buyer_name      TEXT,
  p_buyer_email     TEXT,
  p_address         TEXT,
  p_buyer_user_id   UUID    DEFAULT NULL,
  p_listing_id      UUID    DEFAULT NULL,
  p_target_user_id  UUID    DEFAULT NULL,
  p_message         TEXT    DEFAULT NULL,
  p_referred_by     TEXT    DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_offer_id UUID;
BEGIN
  INSERT INTO public.offers (
    buyer_user_id, buyer_name, buyer_email, target_address,
    target_listing_id, target_user_id, message, referred_by
  ) VALUES (
    p_buyer_user_id, p_buyer_name, p_buyer_email, p_address,
    p_listing_id, p_target_user_id, p_message, p_referred_by
  ) RETURNING id INTO v_offer_id;

  -- Notify homeowner if known
  IF p_target_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      p_target_user_id,
      'offer_received',
      'New offer on ' || p_address,
      p_buyer_name || ' submitted an offer on your property.',
      jsonb_build_object(
        'offer_id', v_offer_id,
        'buyer_name', p_buyer_name,
        'buyer_email', p_buyer_email,
        'address', p_address
      )
    );
  END IF;

  -- Upgrade referral status to offer_submitted
  IF p_referred_by IS NOT NULL AND p_buyer_user_id IS NOT NULL THEN
    UPDATE public.referrals
    SET status = 'offer_submitted'
    WHERE referrer_code = p_referred_by
      AND referred_user_id = p_buyer_user_id
      AND status = 'signed_up';
  END IF;

  RETURN v_offer_id;
END;
$$;

-- Register a referral when new user signs up via /r/[code]
CREATE OR REPLACE FUNCTION register_referral(
  p_code        TEXT,
  p_new_user_id UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer_id UUID;
BEGIN
  SELECT id INTO v_referrer_id FROM public.profiles WHERE refer_code = p_code;
  IF v_referrer_id IS NULL OR v_referrer_id = p_new_user_id THEN RETURN; END IF;

  -- Tag new user's profile
  UPDATE public.profiles SET referred_by = p_code WHERE id = p_new_user_id;

  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referrer_code, referred_user_id, status)
  VALUES (v_referrer_id, p_code, p_new_user_id, 'signed_up')
  ON CONFLICT DO NOTHING;

  -- Notify referrer
  INSERT INTO public.notifications (user_id, type, title, body)
  VALUES (
    v_referrer_id,
    'referral_signup',
    'Someone joined via your link!',
    'A new user signed up using your referral link. You''ll earn 100 points when they close a deal on Eichler Market.'
  );
END;
$$;

-- Award points when a referred deal closes (Tim calls this manually)
CREATE OR REPLACE FUNCTION award_referral_points(
  p_referrer_code TEXT,
  p_points        INTEGER DEFAULT 100
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer_id UUID;
  v_new_pts     INTEGER;
BEGIN
  SELECT id INTO v_referrer_id FROM public.profiles WHERE refer_code = p_referrer_code;
  IF v_referrer_id IS NULL THEN RETURN; END IF;

  UPDATE public.profiles
  SET points = LEAST(300, points + p_points),
      referrals_count = referrals_count + 1
  WHERE id = v_referrer_id
  RETURNING points INTO v_new_pts;

  UPDATE public.referrals
  SET status = 'closed', points_awarded = p_points
  WHERE referrer_id = v_referrer_id AND status IN ('signed_up','offer_submitted')
  ORDER BY created_at DESC LIMIT 1;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_referrer_id,
    'points_earned',
    p_points || ' points earned!',
    'A deal closed via your referral. ' ||
    p_points || ' points = ' || (p_points/100) ||
    '% off your next transaction. Total: ' || v_new_pts || ' pts.',
    jsonb_build_object('points', p_points, 'total', v_new_pts)
  );
END;
$$;


-- ── TRIGGERS ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_listings_updated_at ON public.listings;
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── ROW LEVEL SECURITY ─────────────────────────────────────────────

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Listings: public reads active; owners manage all
CREATE POLICY "Public reads active listings"
  ON public.listings FOR SELECT USING (status = 'active');
CREATE POLICY "Owners manage own listings"
  ON public.listings FOR ALL USING (auth.uid() = user_id);

-- Offers: anyone inserts via RPC; targets and buyers can read
CREATE POLICY "Authenticated can insert offers"
  ON public.offers FOR INSERT WITH CHECK (true);
CREATE POLICY "Relevant parties can read offers"
  ON public.offers FOR SELECT
  USING (auth.uid() = target_user_id OR auth.uid() = buyer_user_id);

-- Referrals: referrers read own
CREATE POLICY "Referrers can read own referrals"
  ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "System can insert referrals"
  ON public.referrals FOR INSERT WITH CHECK (true);

-- Notifications: users manage own
CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL USING (auth.uid() = user_id);


-- ── INDEXES ────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_listings_user    ON public.listings(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_status  ON public.listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_city    ON public.listings(city);
CREATE INDEX IF NOT EXISTS idx_offers_target    ON public.offers(target_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code   ON public.referrals(referrer_code);
CREATE INDEX IF NOT EXISTS idx_notifs_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_profiles_code    ON public.profiles(refer_code);
