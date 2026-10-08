ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_amount numeric NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS orders_payment_ref_idx ON public.orders (payment_ref);

CREATE TABLE public.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (reason IN ('out_of_stock','customer_request','kitchen_delay','input_error','other')),
  payment_provider text NOT NULL CHECK (payment_provider IN ('stripe','mollie','paypal','lyra')),
  provider_refund_id text,
  idempotency_key text NOT NULL UNIQUE,
  year integer NOT NULL,
  seq integer NOT NULL,
  credit_note_number text NOT NULL,
  data jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, credit_note_number)
);
CREATE INDEX order_refunds_order_idx ON public.order_refunds(order_id);
GRANT SELECT ON public.order_refunds TO authenticated;
GRANT ALL ON public.order_refunds TO service_role;
ALTER TABLE public.order_refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read own restaurant refunds" ON public.order_refunds FOR SELECT TO authenticated
  USING (public.can_access_restaurant(auth.uid(), restaurant_id));

CREATE OR REPLACE FUNCTION public.record_refund(_order_id uuid, _restaurant_id uuid, _amount numeric, _reason text, _provider text, _provider_refund_id text, _key text, _data jsonb, _user uuid)
RETURNS public.order_refunds LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.order_refunds; n integer; y integer := extract(year from now())::int; tot numeric; done numeric;
BEGIN
  SELECT * INTO r FROM public.order_refunds WHERE idempotency_key = _key;
  IF FOUND THEN RETURN r; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('credit:' || _restaurant_id::text || ':' || y::text));
  SELECT coalesce(max(seq), 0) + 1 INTO n FROM public.order_refunds WHERE restaurant_id = _restaurant_id AND year = y;
  INSERT INTO public.order_refunds (order_id, restaurant_id, amount, reason, payment_provider, provider_refund_id, idempotency_key, year, seq, credit_note_number, data, created_by)
  VALUES (_order_id, _restaurant_id, _amount, _reason, _provider, _provider_refund_id, _key, y, n, 'AV-' || y::text || '-' || lpad(n::text, 5, '0'), _data, _user)
  RETURNING * INTO r;
  SELECT total, refunded_amount + _amount INTO tot, done FROM public.orders WHERE id = _order_id FOR UPDATE;
  UPDATE public.orders SET refunded_amount = done,
    refund_status = CASE WHEN done >= tot - 0.005 THEN 'full' ELSE 'partial' END,
    payment_status = CASE WHEN done >= tot - 0.005 THEN 'refunded' ELSE 'partially_refunded' END,
    status = CASE WHEN done >= tot - 0.005 AND status NOT IN ('done','delivered') THEN 'cancelled' ELSE status END,
    updated_at = now()
  WHERE id = _order_id;
  RETURN r;
END; $$;
REVOKE ALL ON FUNCTION public.record_refund(uuid, uuid, numeric, text, text, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_refund(uuid, uuid, numeric, text, text, text, text, jsonb, uuid) TO service_role;