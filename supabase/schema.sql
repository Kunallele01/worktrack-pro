-- ============================================================
-- WorkTrack Pro v2 — Supabase Schema
-- ============================================================
-- HOW TO RUN:
--   1. Open supabase.com → your project → SQL Editor
--   2. Click "New Query"
--   3. Paste this entire file
--   4. Click "Run"
-- ============================================================

-- ============================================================
-- PROFILES TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID          PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email       VARCHAR(150)  UNIQUE NOT NULL,
    employee_id VARCHAR(20)   UNIQUE NOT NULL,
    full_name   VARCHAR(100)  NOT NULL,
    department  VARCHAR(100)  DEFAULT '',
    is_admin    BOOLEAN       DEFAULT FALSE,
    is_active   BOOLEAN       DEFAULT TRUE,
    created_at  TIMESTAMPTZ   DEFAULT NOW(),
    last_login  TIMESTAMPTZ
);

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance (
    id             BIGSERIAL    PRIMARY KEY,
    user_id        UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date           DATE         NOT NULL,
    check_in_time  TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    status         VARCHAR(20)  NOT NULL CHECK (status IN ('in_office','wfh','absent','auto_checkout')),
    is_late        BOOLEAN      DEFAULT FALSE,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    accuracy_m     DOUBLE PRECISION,
    notes          TEXT,
    UNIQUE(user_id, date)
);

-- ============================================================
-- APP SETTINGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT         NOT NULL,
    updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- TRIGGER: auto-create profile on user registration
-- The FIRST user registered is automatically made admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count    INTEGER;
    v_emp_id   TEXT;
    v_name     TEXT;
    v_dept     TEXT;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.profiles;

    v_emp_id := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'employee_id'), ''),
        'EMP' || LPAD((v_count + 1)::TEXT, 3, '0')
    );
    v_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        SPLIT_PART(NEW.email, '@', 1)
    );
    v_dept := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'department'), ''), '');

    INSERT INTO public.profiles
        (id, email, employee_id, full_name, department, is_admin, is_active)
    VALUES
        (NEW.id, NEW.email, v_emp_id, v_name, v_dept, (v_count = 0), TRUE)
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: look up email by employee_id (used for login)
-- Runs without RLS (SECURITY DEFINER) so pre-auth lookup works.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_email_by_employee_id(p_employee_id VARCHAR)
RETURNS VARCHAR
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT email FROM public.profiles WHERE employee_id = p_employee_id LIMIT 1;
$$;

-- ============================================================
-- HELPER: returns TRUE if the logged-in user is an admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Drop old policies if re-running this script
DROP POLICY IF EXISTS "profiles_select"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update"  ON public.profiles;
DROP POLICY IF EXISTS "attend_select"    ON public.attendance;
DROP POLICY IF EXISTS "attend_insert"    ON public.attendance;
DROP POLICY IF EXISTS "attend_update"    ON public.attendance;
DROP POLICY IF EXISTS "attend_delete"    ON public.attendance;
DROP POLICY IF EXISTS "settings_select"  ON public.app_settings;
DROP POLICY IF EXISTS "settings_write"   ON public.app_settings;

-- PROFILES policies
CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- ATTENDANCE policies
CREATE POLICY "attend_select" ON public.attendance
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "attend_insert" ON public.attendance
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attend_update" ON public.attendance
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "attend_delete" ON public.attendance
    FOR DELETE USING (public.is_admin());

-- APP SETTINGS policies
CREATE POLICY "settings_select" ON public.app_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "settings_write" ON public.app_settings
    FOR ALL USING (public.is_admin());

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attend_user_date ON public.attendance(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_attend_date      ON public.attendance(date DESC);
CREATE INDEX IF NOT EXISTS idx_attend_status    ON public.attendance(status);
CREATE INDEX IF NOT EXISTS idx_profiles_emp_id  ON public.profiles(employee_id);

-- ============================================================
-- DEFAULT SETTINGS (your actual office coordinates pre-loaded)
-- ============================================================
INSERT INTO public.app_settings (key, value) VALUES
    ('office_latitude',   '18.460204818819722'),
    ('office_longitude',  '73.79893806749008'),
    ('office_radius_m',   '200'),
    ('office_start_time', '09:30'),
    ('admin_email',       ''),
    ('wfh_notify_emails', ''),
    ('app_name',          'WorkTrack Pro'),
    ('company_name',      'Your Company'),
    ('resend_api_key',    ''),
    ('from_email',        'noreply@worktrack.app')
ON CONFLICT (key) DO NOTHING;
