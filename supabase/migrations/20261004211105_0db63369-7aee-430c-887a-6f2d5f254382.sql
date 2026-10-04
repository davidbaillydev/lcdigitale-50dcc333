CREATE TABLE public.restaurant_voice_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  call_id text NOT NULL,
  caller text,
  status text NOT NULL DEFAULT 'en cours',
  ended_reason text,
  duration_seconds integer,
  order_number integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, call_id)
);
GRANT ALL ON public.restaurant_voice_calls TO service_role;
ALTER TABLE public.restaurant_voice_calls ENABLE ROW LEVEL SECURITY;
CREATE INDEX restaurant_voice_calls_rest_idx ON public.restaurant_voice_calls (restaurant_id, created_at DESC);