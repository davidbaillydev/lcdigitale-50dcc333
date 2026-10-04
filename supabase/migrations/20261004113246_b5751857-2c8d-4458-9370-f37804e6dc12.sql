CREATE TABLE public.restaurant_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text,
  email text,
  phone text,
  marketing_consent boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  consent_source text,
  source text NOT NULL DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_has_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX restaurant_customers_email_uq ON public.restaurant_customers (restaurant_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX restaurant_customers_phone_uq ON public.restaurant_customers (restaurant_id, phone) WHERE phone IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_customers TO authenticated;
GRANT ALL ON public.restaurant_customers TO service_role;
ALTER TABLE public.restaurant_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage customers" ON public.restaurant_customers FOR ALL TO authenticated
  USING (public.is_restaurant_manager(auth.uid(), restaurant_id))
  WITH CHECK (public.is_restaurant_manager(auth.uid(), restaurant_id));
CREATE TRIGGER restaurant_customers_updated_at BEFORE UPDATE ON public.restaurant_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();