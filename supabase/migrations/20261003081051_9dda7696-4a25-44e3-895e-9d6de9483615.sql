CREATE TABLE public.restaurant_kitchen_pins (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  salt text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.restaurant_kitchen_pins TO service_role;
ALTER TABLE public.restaurant_kitchen_pins ENABLE ROW LEVEL SECURITY;