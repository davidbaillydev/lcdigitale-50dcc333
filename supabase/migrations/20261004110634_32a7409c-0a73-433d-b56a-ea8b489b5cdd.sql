CREATE TABLE public.restaurant_promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('percent','fixed')),
  value numeric NOT NULL CHECK (value > 0),
  min_order numeric NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, code)
);
GRANT ALL ON public.restaurant_promo_codes TO service_role;
ALTER TABLE public.restaurant_promo_codes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER restaurant_promo_codes_updated_at BEFORE UPDATE ON public.restaurant_promo_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.orders ADD COLUMN discount numeric NOT NULL DEFAULT 0, ADD COLUMN promo_code text;