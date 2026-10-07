CREATE TABLE public.restaurant_pdp_configs (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('jefacture','pennylane','dext','other')),
  account_id text NOT NULL DEFAULT '',
  mandate_signed boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.restaurant_pdp_configs TO service_role;
ALTER TABLE public.restaurant_pdp_configs ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.restaurant_pdp_configs IS 'PDP account credentials; service-role only, accessed via server functions.';