ALTER TABLE public.orders ADD COLUMN pos_payments jsonb;
ALTER TABLE public.orders ADD COLUMN pos_discount jsonb;
ALTER TABLE public.orders ADD COLUMN pos_vat jsonb;
CREATE TABLE public.pos_cash_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),session_id uuid NOT NULL REFERENCES public.pos_sessions(id),order_id uuid REFERENCES public.orders(id),kind text NOT NULL CHECK(kind IN ('in','out','void')),amount numeric(10,2) NOT NULL CHECK(amount>=0),reason text NOT NULL CHECK(length(trim(reason))>=3),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),snapshot jsonb,request_id uuid NOT NULL,UNIQUE(restaurant_id,request_id));
GRANT SELECT ON public.pos_cash_events TO authenticated;
GRANT ALL ON public.pos_cash_events TO service_role;
ALTER TABLE public.pos_cash_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_events_manager ON public.pos_cash_events FOR SELECT TO authenticated USING(public.is_restaurant_manager(auth.uid(),restaurant_id));
CREATE UNIQUE INDEX pos_void_once ON public.pos_cash_events(order_id) WHERE kind='void';
CREATE TABLE public.pos_parked_carts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),session_id uuid NOT NULL REFERENCES public.pos_sessions(id),label text NOT NULL,draft jsonb NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),recalled_at timestamptz,request_id uuid NOT NULL,UNIQUE(restaurant_id,request_id));
GRANT SELECT ON public.pos_parked_carts TO authenticated;
GRANT ALL ON public.pos_parked_carts TO service_role;
ALTER TABLE public.pos_parked_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_park_manager ON public.pos_parked_carts FOR SELECT TO authenticated USING(public.is_restaurant_manager(auth.uid(),restaurant_id));
CREATE FUNCTION public.pos_open_session_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Immutable cash event'; END IF;
 PERFORM id FROM public.pos_sessions WHERE id=NEW.session_id AND restaurant_id=NEW.restaurant_id AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Caisse fermée'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER pos_events_lock BEFORE INSERT OR UPDATE OR DELETE ON public.pos_cash_events FOR EACH ROW EXECUTE FUNCTION public.pos_open_session_lock();
CREATE TRIGGER pos_park_lock BEFORE INSERT ON public.pos_parked_carts FOR EACH ROW EXECUTE FUNCTION public.pos_open_session_lock();
CREATE FUNCTION public.pos_sale_financial_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF OLD.source='pos' AND (NEW.total IS DISTINCT FROM OLD.total OR NEW.discount IS DISTINCT FROM OLD.discount OR NEW.items IS DISTINCT FROM OLD.items OR NEW.pos_payments IS DISTINCT FROM OLD.pos_payments OR NEW.pos_vat IS DISTINCT FROM OLD.pos_vat OR NEW.pos_tender IS DISTINCT FROM OLD.pos_tender) THEN RAISE EXCEPTION 'Immutable POS sale'; END IF;
 IF OLD.source='pos' AND NEW.status='cancelled' AND OLD.status<>'cancelled' THEN
  PERFORM id FROM public.pos_sessions WHERE id=OLD.pos_session_id AND closed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.pos_cash_events WHERE order_id=OLD.id AND kind='void') THEN RAISE EXCEPTION 'Annulation responsable avec motif requise'; END IF;
 END IF;
 RETURN NEW; END $$;
CREATE TRIGGER pos_sale_financial_guard BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.pos_sale_financial_lock();
CREATE FUNCTION public.pos_session_report(_session_id uuid,_counted numeric DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.pos_sessions; methods jsonb; vats jsonb; cash_in numeric; cash_out numeric; cash numeric; rep jsonb;
BEGIN
 SELECT * INTO s FROM public.pos_sessions WHERE id=_session_id;
 SELECT jsonb_object_agg(method,jsonb_build_object('count',n,'amount',amount)) INTO methods FROM (
 SELECT m AS method,count(p.order_id) n,coalesce(sum(p.amount),0) amount FROM unnest(ARRAY['cash','card','meal_voucher']) m LEFT JOIN (
 SELECT o.id AS order_id,t->>'method' method,(t->>'amount')::numeric amount FROM public.orders o CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.pos_payments,jsonb_build_array(jsonb_build_object('method',coalesce(o.pos_tender->>'method','cash'),'amount',o.total)))) t WHERE o.pos_session_id=_session_id AND o.status<>'cancelled') p ON p.method=m GROUP BY m) x;
 SELECT coalesce(jsonb_agg(jsonb_build_object('rate',rate,'ht',ht,'vat',vat,'ttc',ttc) ORDER BY rate),'[]'::jsonb) INTO vats FROM (
 SELECT (v->>'rate')::numeric rate,sum((v->>'ht')::numeric) ht,sum((v->>'vat')::numeric) vat,sum((v->>'ttc')::numeric) ttc FROM public.orders o CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.pos_vat,'[]'::jsonb)) v WHERE o.pos_session_id=_session_id AND o.status<>'cancelled' GROUP BY (v->>'rate')::numeric) x;
 SELECT coalesce(sum(amount) FILTER(WHERE kind='in'),0),coalesce(sum(amount) FILTER(WHERE kind='out'),0) INTO cash_in,cash_out FROM public.pos_cash_events WHERE session_id=_session_id;
 cash:=s.opening_float+(methods->'cash'->>'amount')::numeric+cash_in-cash_out;
 SELECT jsonb_build_object('orders',count(*) FILTER(WHERE status<>'cancelled'),'cancelled',count(*) FILTER(WHERE status='cancelled'),'total',coalesce(sum(total) FILTER(WHERE status<>'cancelled'),0),'discountTotal',coalesce(sum(discount) FILTER(WHERE status<>'cancelled'),0),'cancelledAmount',coalesce(sum(total) FILTER(WHERE status='cancelled'),0),'vatMissing',count(*) FILTER(WHERE status<>'cancelled' AND pos_vat IS NULL)) INTO rep FROM public.orders WHERE pos_session_id=_session_id;
 RETURN rep||jsonb_build_object('byMethod',methods,'vat',vats,'cashIn',cash_in,'cashOut',cash_out,'openingFloat',s.opening_float,'expectedCash',cash,'countedCash',_counted,'cashDifference',CASE WHEN _counted IS NULL THEN NULL ELSE round(_counted,2)-cash END,'events',coalesce((SELECT jsonb_agg(jsonb_build_object('kind',kind,'amount',amount,'reason',reason,'at',created_at,'createdBy',created_by,'orderId',order_id,'snapshot',snapshot) ORDER BY created_at) FROM public.pos_cash_events WHERE session_id=_session_id),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.pos_session_report(uuid,numeric) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pos_session_report(uuid,numeric) TO service_role;
CREATE OR REPLACE FUNCTION public.close_pos_register(_restaurant_id uuid,_user_id uuid,_counted_cash numeric) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.pos_sessions; rep jsonb; zn integer; closed_time timestamptz:=now(); BEGIN
 IF NOT public.is_restaurant_manager(_user_id,_restaurant_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _counted_cash IS NULL OR _counted_cash<0 OR _counted_cash>100000 THEN RAISE EXCEPTION 'Invalid cash'; END IF;
 SELECT * INTO s FROM public.pos_sessions WHERE restaurant_id=_restaurant_id AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aucune caisse ouverte'; END IF;
 IF EXISTS(SELECT 1 FROM public.pos_parked_carts WHERE session_id=s.id AND recalled_at IS NULL) THEN RAISE EXCEPTION 'Reprenez les paniers en attente avant clôture'; END IF;
 rep:=public.pos_session_report(s.id,round(_counted_cash,2));
 SELECT coalesce(max(z_number),0)+1 INTO zn FROM public.pos_sessions WHERE restaurant_id=_restaurant_id;
 UPDATE public.pos_sessions SET closed_at=closed_time,closed_by=_user_id,counted_cash=round(_counted_cash,2),z_number=zn,z_report=rep WHERE id=s.id;
 RETURN jsonb_build_object('z_number',zn,'report',rep,'opened_at',s.opened_at,'closed_at',closed_time); END $$;
CREATE FUNCTION public.void_pos_sale(_restaurant_id uuid,_order_id uuid,_user_id uuid,_reason text,_request_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders; BEGIN
 IF NOT public.is_restaurant_manager(_user_id,_restaurant_id) OR length(trim(_reason))<3 THEN RAISE EXCEPTION 'Forbidden or missing reason'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=_order_id AND restaurant_id=_restaurant_id AND source='pos';
 IF NOT FOUND THEN RAISE EXCEPTION 'Vente introuvable'; END IF;
 PERFORM id FROM public.pos_sessions WHERE id=o.pos_session_id AND closed_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'La session est déjà clôturée'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=_order_id FOR UPDATE;
 IF o.status='cancelled' THEN RETURN jsonb_build_object('ok',true); END IF;
 INSERT INTO public.pos_cash_events(restaurant_id,session_id,order_id,kind,amount,reason,created_by,snapshot,request_id) VALUES(_restaurant_id,o.pos_session_id,o.id,'void',o.total,trim(_reason),_user_id,jsonb_build_object('receipt',o.pos_receipt_number,'payments',o.pos_payments,'vat',o.pos_vat),_request_id);
 UPDATE public.orders SET status='cancelled' WHERE id=o.id;
 RETURN jsonb_build_object('ok',true); END $$;
REVOKE ALL ON FUNCTION public.void_pos_sale(uuid,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.void_pos_sale(uuid,uuid,uuid,text,uuid) TO service_role;