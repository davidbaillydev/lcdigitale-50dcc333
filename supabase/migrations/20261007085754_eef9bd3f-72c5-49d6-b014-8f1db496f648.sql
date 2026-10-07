ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status in ('awaiting_payment','pending_approval','new','accepted','ready','done','cancelled'));

CREATE TABLE public.restaurant_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_drivers TO authenticated;
GRANT ALL ON public.restaurant_drivers TO service_role;
ALTER TABLE public.restaurant_drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read drivers" ON public.restaurant_drivers FOR SELECT TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Managers manage drivers" ON public.restaurant_drivers FOR ALL TO authenticated USING (public.is_restaurant_manager(auth.uid(), restaurant_id)) WITH CHECK (public.is_restaurant_manager(auth.uid(), restaurant_id));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES public.restaurant_drivers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_driver_idx ON public.orders(driver_id);