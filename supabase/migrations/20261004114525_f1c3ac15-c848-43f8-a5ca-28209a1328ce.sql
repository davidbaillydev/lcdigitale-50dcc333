CREATE TABLE public.restaurant_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  subject text NOT NULL,
  recipients integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_campaigns TO authenticated;
GRANT ALL ON public.restaurant_campaigns TO service_role;
ALTER TABLE public.restaurant_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read campaigns" ON public.restaurant_campaigns FOR SELECT TO authenticated
  USING (public.is_restaurant_manager(auth.uid(), restaurant_id));