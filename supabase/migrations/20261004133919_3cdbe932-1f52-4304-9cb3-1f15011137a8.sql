ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_source_check CHECK (source in ('web','kiosk','phone'));

CREATE TABLE public.restaurant_voice_channels (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  webhook_secret text NOT NULL,
  phone_number text,
  calls_count integer NOT NULL DEFAULT 0,
  last_call_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.restaurant_voice_channels TO service_role;
ALTER TABLE public.restaurant_voice_channels ENABLE ROW LEVEL SECURITY;