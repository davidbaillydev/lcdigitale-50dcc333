CREATE TABLE public.order_print_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  kinds text NOT NULL,
  status text NOT NULL CHECK (status IN ('ok','failed')),
  reprint boolean NOT NULL DEFAULT false,
  auto boolean NOT NULL DEFAULT false,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_print_logs TO authenticated;
GRANT ALL ON public.order_print_logs TO service_role;
ALTER TABLE public.order_print_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read print logs" ON public.order_print_logs FOR SELECT TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Staff add print logs" ON public.order_print_logs FOR INSERT TO authenticated WITH CHECK (
  public.can_access_restaurant(auth.uid(), restaurant_id)
  AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.restaurant_id = order_print_logs.restaurant_id)
);
CREATE INDEX order_print_logs_order_idx ON public.order_print_logs(order_id, created_at);