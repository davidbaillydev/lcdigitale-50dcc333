CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text,
  party_size integer NOT NULL,
  starts_at timestamptz NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending_card',
  no_show_fee numeric NOT NULL DEFAULT 0,
  stripe_customer text,
  setup_intent text,
  payment_method text,
  charged_amount numeric,
  charge_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read reservations" ON public.reservations FOR SELECT TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Staff update reservations" ON public.reservations FOR UPDATE TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.can_access_restaurant(auth.uid(), restaurant_id));
CREATE INDEX reservations_restaurant_starts ON public.reservations(restaurant_id, starts_at);
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;