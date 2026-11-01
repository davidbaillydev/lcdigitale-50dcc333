CREATE TABLE public.pos_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  z_number integer,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  opening_float numeric(10,2) NOT NULL DEFAULT 0,
  closed_by uuid,
  closed_at timestamptz,
  counted_cash numeric(10,2),
  z_report jsonb
);
CREATE UNIQUE INDEX pos_sessions_one_open ON public.pos_sessions(restaurant_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX pos_sessions_z_number ON public.pos_sessions(restaurant_id, z_number) WHERE z_number IS NOT NULL;
GRANT SELECT ON public.pos_sessions TO authenticated;
GRANT ALL ON public.pos_sessions TO service_role;
ALTER TABLE public.pos_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read pos sessions" ON public.pos_sessions FOR SELECT TO authenticated USING (public.is_restaurant_manager(auth.uid(), restaurant_id));

ALTER TABLE public.orders ADD COLUMN pos_session_id uuid REFERENCES public.pos_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN pos_tender jsonb;
CREATE INDEX orders_pos_session_idx ON public.orders(pos_session_id) WHERE pos_session_id IS NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_source_check CHECK (source IN ('web','kiosk','phone','embed','facebook','link','qr','pos'));