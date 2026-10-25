-- =======================================================
-- PUNE RENT AGREEMENT AUTOMATION SYSTEM - DATABASE SCHEMA
-- Target Database: Supabase PostgreSQL (Project: itttupazvxznfauoqddk)
-- =======================================================

-- 1. Create Agreements Table
CREATE TABLE IF NOT EXISTS public.agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_number TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'AI Processing',
    mobile_number TEXT,
    landlord JSONB NOT NULL DEFAULT '{}'::jsonb,
    tenants JSONB NOT NULL DEFAULT '[]'::jsonb,
    witnesses JSONB NOT NULL DEFAULT '[]'::jsonb,
    property_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    financials JSONB NOT NULL DEFAULT '{}'::jsonb,
    grn_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    files JSONB NOT NULL DEFAULT '{}'::jsonb,
    synced_to_sheets BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Index on Token Number and Mobile
CREATE INDEX IF NOT EXISTS idx_agreements_token ON public.agreements(token_number);
CREATE INDEX IF NOT EXISTS idx_agreements_mobile ON public.agreements(mobile_number);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

-- 4. Create Public Access Policy for Insert & Select (Anon Key Access)
CREATE POLICY "Allow public insert and select" 
ON public.agreements 
FOR ALL 
USING (true) 
WITH CHECK (true);
