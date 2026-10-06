CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  audience text NOT NULL DEFAULT 'customer',
  last_title text, last_body text, last_url text, last_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_order_idx ON public.push_subscriptions(order_id);
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;