CREATE TABLE public.restaurant_payment_providers (
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('sumup','stripe','paypal','lyra')),
  enabled boolean NOT NULL DEFAULT false,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, provider)
);
GRANT ALL ON public.restaurant_payment_providers TO service_role;
ALTER TABLE public.restaurant_payment_providers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER restaurant_payment_providers_updated_at BEFORE UPDATE ON public.restaurant_payment_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.orders ADD COLUMN payment_ref text;