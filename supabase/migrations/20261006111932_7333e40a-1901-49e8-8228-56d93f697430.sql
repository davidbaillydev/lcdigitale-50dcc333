ALTER TABLE public.restaurant_invoices ADD COLUMN IF NOT EXISTS year integer;
UPDATE public.restaurant_invoices SET year = extract(year from issued_at)::int WHERE year IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_invoices_rest_number_uniq ON public.restaurant_invoices(restaurant_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_invoices_order_uniq ON public.restaurant_invoices(order_id);

CREATE OR REPLACE FUNCTION public.issue_invoice(_order_id uuid, _restaurant_id uuid, _data jsonb)
 RETURNS restaurant_invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.restaurant_invoices; n integer; y integer := extract(year from now())::int;
BEGIN
  SELECT * INTO r FROM public.restaurant_invoices WHERE order_id = _order_id;
  IF FOUND THEN RETURN r; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('invoice:' || _restaurant_id::text || ':' || y::text));
  SELECT coalesce(max(seq), 0) + 1 INTO n FROM public.restaurant_invoices WHERE restaurant_id = _restaurant_id AND year = y;
  INSERT INTO public.restaurant_invoices (restaurant_id, order_id, seq, year, number, data)
  VALUES (_restaurant_id, _order_id, n, y, 'FAC-' || y::text || '-' || lpad(n::text, 5, '0'), _data)
  RETURNING * INTO r;
  RETURN r;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.issue_invoice(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_invoice(uuid, uuid, jsonb) TO service_role;