ALTER TABLE public.orders ADD COLUMN pos_receipt_number bigint;
ALTER TABLE public.orders ADD COLUMN pos_request_id uuid;
CREATE UNIQUE INDEX orders_pos_request_unique ON public.orders(restaurant_id, pos_request_id) WHERE pos_request_id IS NOT NULL;
CREATE UNIQUE INDEX orders_pos_receipt_unique ON public.orders(restaurant_id, pos_receipt_number) WHERE pos_receipt_number IS NOT NULL;
CREATE TABLE public.pos_receipt_counters (restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id), last_number bigint NOT NULL DEFAULT 0);
GRANT ALL ON public.pos_receipt_counters TO service_role;
ALTER TABLE public.pos_receipt_counters ENABLE ROW LEVEL SECURITY;
WITH numbered AS (SELECT id, restaurant_id, row_number() OVER (PARTITION BY restaurant_id ORDER BY created_at, order_number, id) AS n FROM public.orders WHERE source='pos') UPDATE public.orders o SET pos_receipt_number=n.n FROM numbered n WHERE o.id=n.id;
INSERT INTO public.pos_receipt_counters(restaurant_id,last_number) SELECT restaurant_id,max(pos_receipt_number) FROM public.orders WHERE source='pos' GROUP BY restaurant_id;
CREATE FUNCTION public.assign_pos_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.pos_receipt_number IS DISTINCT FROM OLD.pos_receipt_number OR NEW.pos_session_id IS DISTINCT FROM OLD.pos_session_id OR NEW.pos_request_id IS DISTINCT FROM OLD.pos_request_id THEN RAISE EXCEPTION 'POS receipt identity is immutable'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.source='pos' THEN
  PERFORM id FROM public.pos_sessions WHERE id=NEW.pos_session_id AND restaurant_id=NEW.restaurant_id AND closed_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'POS session closed'; END IF;
  INSERT INTO public.pos_receipt_counters(restaurant_id,last_number) VALUES(NEW.restaurant_id,1) ON CONFLICT(restaurant_id) DO UPDATE SET last_number=pos_receipt_counters.last_number+1 RETURNING last_number INTO NEW.pos_receipt_number;
 ELSIF NEW.pos_receipt_number IS NOT NULL OR NEW.pos_session_id IS NOT NULL OR NEW.pos_request_id IS NOT NULL THEN RAISE EXCEPTION 'POS identity reserved for POS sales';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER orders_assign_pos_receipt BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.assign_pos_receipt();
CREATE FUNCTION public.close_pos_register(_restaurant_id uuid,_user_id uuid,_counted_cash numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.pos_sessions; rep jsonb; methods jsonb; cash numeric; total_sales numeric; sale_count integer; cancelled_count integer; zn integer; closed_time timestamptz:=now();
BEGIN
 IF NOT public.is_restaurant_manager(_user_id,_restaurant_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _counted_cash IS NULL OR _counted_cash<0 OR _counted_cash>100000 THEN RAISE EXCEPTION 'Invalid cash'; END IF;
 SELECT * INTO s FROM public.pos_sessions WHERE restaurant_id=_restaurant_id AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aucune caisse ouverte.'; END IF;
 SELECT count(*) FILTER(WHERE status<>'cancelled'), count(*) FILTER(WHERE status='cancelled'),coalesce(sum(total) FILTER(WHERE status<>'cancelled'),0) INTO sale_count,cancelled_count,total_sales FROM public.orders WHERE pos_session_id=s.id;
 SELECT jsonb_object_agg(m,jsonb_build_object('count',n,'amount',a)) INTO methods FROM (SELECT m,count(o.id) AS n,coalesce(sum(o.total),0) AS a FROM unnest(ARRAY['cash','card','meal_voucher']) m LEFT JOIN public.orders o ON o.pos_session_id=s.id AND o.status<>'cancelled' AND coalesce(o.pos_tender->>'method','cash')=m GROUP BY m) v;
 cash:=s.opening_float+(methods->'cash'->>'amount')::numeric;
 SELECT coalesce(max(z_number),0)+1 INTO zn FROM public.pos_sessions WHERE restaurant_id=_restaurant_id;
 rep:=jsonb_build_object('orders',sale_count,'cancelled',cancelled_count,'total',total_sales,'byMethod',methods,'openingFloat',s.opening_float,'expectedCash',cash,'countedCash',round(_counted_cash,2),'cashDifference',round(_counted_cash,2)-cash);
 UPDATE public.pos_sessions SET closed_at=closed_time,closed_by=_user_id,counted_cash=round(_counted_cash,2),z_number=zn,z_report=rep WHERE id=s.id;
 RETURN jsonb_build_object('z_number',zn,'report',rep,'opened_at',s.opened_at,'closed_at',closed_time);
END $$;
REVOKE ALL ON FUNCTION public.close_pos_register(uuid,uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.close_pos_register(uuid,uuid,numeric) TO service_role;