-- ====================================================================
-- PUNE RENT AGREEMENT AUTOMATION - SCHEMA MIGRATION & SECURITY HARDENING
-- Target: Supabase PostgreSQL (Project: itttupazvxznfauoqddk)
-- ====================================================================

-- 1. ATOMIC TOKEN SEQUENCE TABLE & FUNCTION (Resets annually on Jan 1)
CREATE TABLE IF NOT EXISTS public.token_sequences (
    year INT PRIMARY KEY,
    last_val INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic SQL token generator function: format PNE-YYYY-NNNN
CREATE OR REPLACE FUNCTION public.generate_next_token(p_year INT)
RETURNS TEXT AS $$
DECLARE
    v_val INT;
    v_token TEXT;
BEGIN
    INSERT INTO public.token_sequences (year, last_val, updated_at)
    VALUES (p_year, 1, NOW())
    ON CONFLICT (year)
    DO UPDATE SET 
        last_val = token_sequences.last_val + 1,
        updated_at = NOW()
    RETURNING last_val INTO v_val;

    v_token := 'PNE-' || p_year::TEXT || '-' || LPAD(v_val::TEXT, 4, '0');
    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to service role
GRANT EXECUTE ON FUNCTION public.generate_next_token(INT) TO service_role;

-- 2. STAFF USERS ALLOW-LIST TABLE (For dashboard and extension authentication)
CREATE TABLE IF NOT EXISTS public.staff_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample default agency staff
INSERT INTO public.staff_users (email, role)
VALUES 
    ('staff@agency.com', 'admin'),
    ('admin@agency.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- 3. INDEXES ON AGREEMENTS TABLE
CREATE INDEX IF NOT EXISTS idx_agreements_token ON public.agreements(token_number);
CREATE INDEX IF NOT EXISTS idx_agreements_mobile ON public.agreements(mobile_number);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON public.agreements(status);
CREATE INDEX IF NOT EXISTS idx_agreements_created_at ON public.agreements(created_at DESC);

-- 4. ROW LEVEL SECURITY (RLS) HARDENING
-- Remove the open policy allowing anonymous public insert and select
DROP POLICY IF EXISTS "Allow public insert and select" ON public.agreements;
DROP POLICY IF EXISTS "Allow public read" ON public.agreements;
DROP POLICY IF EXISTS "Allow public insert" ON public.agreements;

ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- Note: All backend operations (intake create, staff read/edit) run server-side
-- via SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS automatically.
-- Public anon key access is strictly disallowed by leaving no anon policies.

-- 5. PRIVATE STORAGE BUCKET CONFIGURATION ('agreement-docs')
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'agreement-docs',
    'agreement-docs',
    FALSE,
    20971520, -- 20 MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET 
    public = FALSE,
    file_size_limit = 20971520;

-- Ensure storage objects table has RLS enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Prevent anonymous direct reads or writes to the private agreement-docs bucket
DROP POLICY IF EXISTS "Public can view agreement docs" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload agreement docs" ON storage.objects;

-- Only service role has full access to the bucket
-- ====================================================================
