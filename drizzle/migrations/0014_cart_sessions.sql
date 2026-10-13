CREATE TABLE public.cart_sessions (
  session_id uuid PRIMARY KEY,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'web' CHECK (channel IN ('web','borne','qr_code')),
  current_step text NOT NULL DEFAULT 'view_menu' CHECK (current_step IN ('view_menu','add_to_cart','checkout_started','payment_pending','completed','abandoned')),
  max_step smallint NOT NULL DEFAULT 0,
  cart_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  cart_total numeric NOT NULL DEFAULT 0,
  exit_page text,
  traffic_source text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cart_sessions_rest_time ON public.cart_sessions (restaurant_id, created_at DESC);
GRANT SELECT ON public.cart_sessions TO authenticated;
GRANT ALL ON public.cart_sessions TO service_role;
ALTER TABLE public.cart_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own restaurant sessions" ON public.cart_sessions FOR SELECT TO authenticated
  USING (public.can_access_restaurant(auth.uid(), restaurant_id));