ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing jsonb;
ALTER TABLE public.restaurant_invoices ADD COLUMN IF NOT EXISTS buyer_b2b jsonb;
ALTER TABLE public.restaurant_invoices ADD COLUMN IF NOT EXISTS buyer_b2b_updated_at timestamptz;
ALTER TABLE public.restaurant_invoices ADD COLUMN IF NOT EXISTS buyer_b2b_by uuid;
COMMENT ON COLUMN public.restaurant_invoices.buyer_b2b IS 'Traceable B2B buyer complement added after issuance; frozen data column is never modified.';