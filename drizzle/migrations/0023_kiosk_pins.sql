CREATE TABLE public.restaurant_kiosk_pins (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  salt text NOT NULL,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.restaurant_kiosk_pins TO service_role;
ALTER TABLE public.restaurant_kiosk_pins ENABLE ROW LEVEL SECURITY;