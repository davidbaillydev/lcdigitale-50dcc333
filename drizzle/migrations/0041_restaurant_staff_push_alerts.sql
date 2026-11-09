CREATE TABLE public.staff_push_devices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 endpoint text NOT NULL UNIQUE,
 user_id uuid NOT NULL,
 restaurant_ids uuid[] NOT NULL DEFAULT '{}',
 token_hash text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.staff_push_devices TO service_role;
ALTER TABLE public.staff_push_devices ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.staff_push_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 device_id uuid NOT NULL REFERENCES public.staff_push_devices(id) ON DELETE CASCADE,
 order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 title text NOT NULL,
 url text NOT NULL,
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(device_id, order_id)
);
GRANT ALL ON public.staff_push_deliveries TO service_role;
ALTER TABLE public.staff_push_deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX staff_push_unread_idx ON public.staff_push_deliveries(device_id, created_at) WHERE read_at IS NULL;