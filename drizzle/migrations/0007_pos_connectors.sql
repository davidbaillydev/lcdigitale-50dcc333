CREATE TABLE IF NOT EXISTS public.restaurant_pos_connectors (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'none' CHECK (provider IN ('none','hubrise','hiboutik','webhook')),
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  silent_sync boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.restaurant_pos_connectors FROM anon, authenticated;
GRANT ALL ON public.restaurant_pos_connectors TO service_role;
ALTER TABLE public.restaurant_pos_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pos_status text,
  ADD COLUMN IF NOT EXISTS pos_ref text,
  ADD COLUMN IF NOT EXISTS pos_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS pos_error text;