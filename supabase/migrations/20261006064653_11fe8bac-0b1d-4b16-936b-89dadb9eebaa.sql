CREATE TABLE public.restaurant_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  seq integer NOT NULL,
  number text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, seq)
);
GRANT SELECT ON public.restaurant_invoices TO authenticated;
GRANT ALL ON public.restaurant_invoices TO service_role;
ALTER TABLE public.restaurant_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read invoices" ON public.restaurant_invoices FOR SELECT TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));

-- Numérotation continue, sans trou, par restaurant (verrou transactionnel)
CREATE OR REPLACE FUNCTION public.issue_invoice(_order_id uuid, _restaurant_id uuid, _data jsonb)
RETURNS public.restaurant_invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.restaurant_invoices; n integer;
BEGIN
  SELECT * INTO r FROM public.restaurant_invoices WHERE order_id = _order_id;
  IF FOUND THEN RETURN r; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('invoice:' || _restaurant_id::text));
  SELECT coalesce(max(seq), 0) + 1 INTO n FROM public.restaurant_invoices WHERE restaurant_id = _restaurant_id;
  INSERT INTO public.restaurant_invoices (restaurant_id, order_id, seq, number, data)
  VALUES (_restaurant_id, _order_id, n, 'F' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0'), _data)
  RETURNING * INTO r;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.issue_invoice(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid, uuid, jsonb) TO service_role;