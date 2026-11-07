ALTER TABLE public.orders ADD COLUMN pos_fiscal_hash text;
ALTER TABLE public.orders ADD COLUMN pos_created_by uuid;
CREATE TABLE public.pos_integrity_heads (restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id), starts_at timestamptz NOT NULL DEFAULT clock_timestamp(), legacy_last_number bigint NOT NULL DEFAULT 0, receipt_number bigint NOT NULL DEFAULT 0, receipt_hash text NOT NULL DEFAULT repeat('0',64), event_number bigint NOT NULL DEFAULT 0, event_hash text NOT NULL DEFAULT repeat('0',64));
GRANT SELECT ON public.pos_integrity_heads TO authenticated;
GRANT ALL ON public.pos_integrity_heads TO service_role;
ALTER TABLE public.pos_integrity_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_heads_agency ON public.pos_integrity_heads FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
INSERT INTO public.pos_integrity_heads(restaurant_id,legacy_last_number,receipt_number) SELECT restaurant_id,last_number,last_number FROM public.pos_receipt_counters;
CREATE TABLE public.pos_fiscal_receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),sequence bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),previous_hash text NOT NULL,hash text NOT NULL,payload_text text NOT NULL,UNIQUE(restaurant_id,sequence));
GRANT SELECT ON public.pos_fiscal_receipts TO authenticated;
GRANT SELECT,INSERT ON public.pos_fiscal_receipts TO service_role;
ALTER TABLE public.pos_fiscal_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_receipts_agency ON public.pos_fiscal_receipts FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.pos_jet (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),sequence bigint NOT NULL,event_type text NOT NULL,actor_id uuid,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),previous_hash text NOT NULL,hash text NOT NULL,payload_text text NOT NULL,UNIQUE(restaurant_id,sequence));
GRANT SELECT ON public.pos_jet TO authenticated;
GRANT SELECT,INSERT ON public.pos_jet TO service_role;
ALTER TABLE public.pos_jet ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_jet_agency ON public.pos_jet FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.pos_fiscal_archives (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),created_by uuid NOT NULL,content_text text NOT NULL,hash text NOT NULL);
GRANT SELECT ON public.pos_fiscal_archives TO authenticated;
GRANT SELECT,INSERT ON public.pos_fiscal_archives TO service_role;
ALTER TABLE public.pos_fiscal_archives ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_archives_agency ON public.pos_fiscal_archives FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.pos_reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Immutable fiscal evidence'; END $$;
CREATE TRIGGER pos_receipts_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pos_fiscal_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.pos_reject_mutation();
CREATE TRIGGER pos_jet_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pos_jet FOR EACH STATEMENT EXECUTE FUNCTION public.pos_reject_mutation();
CREATE TRIGGER pos_archives_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON public.pos_fiscal_archives FOR EACH STATEMENT EXECUTE FUNCTION public.pos_reject_mutation();
CREATE FUNCTION public.pos_append_jet(_restaurant uuid,_type text,_actor uuid,_details jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE h public.pos_integrity_heads; payload text; digest text; at_time timestamptz:=clock_timestamp(); BEGIN
 INSERT INTO public.pos_integrity_heads(restaurant_id) VALUES(_restaurant) ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM public.pos_integrity_heads WHERE restaurant_id=_restaurant FOR UPDATE;
 payload:=jsonb_build_object('version','lc-pos-integrity-v1','restaurantId',_restaurant,'sequence',h.event_number+1,'type',_type,'actorId',_actor,'at',at_time,'details',_details)::text;
 digest:=encode(extensions.digest(convert_to(h.event_hash||E'\n'||payload,'UTF8'),'sha256'),'hex');
 INSERT INTO public.pos_jet(restaurant_id,sequence,event_type,actor_id,created_at,previous_hash,hash,payload_text) VALUES(_restaurant,h.event_number+1,_type,_actor,at_time,h.event_hash,digest,payload);
 UPDATE public.pos_integrity_heads SET event_number=h.event_number+1,event_hash=digest WHERE restaurant_id=_restaurant;
END $$;
REVOKE ALL ON FUNCTION public.pos_append_jet(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pos_append_jet(uuid,text,uuid,jsonb) TO service_role;
CREATE FUNCTION public.pos_chain_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE h public.pos_integrity_heads; payload text; digest text; BEGIN
 IF TG_OP='DELETE' THEN IF OLD.source='pos' THEN RAISE EXCEPTION 'POS sale deletion forbidden'; END IF; RETURN OLD; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.source='pos' AND (NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.pos_fiscal_hash IS DISTINCT FROM OLD.pos_fiscal_hash OR NEW.pos_created_by IS DISTINCT FROM OLD.pos_created_by OR NEW.subtotal IS DISTINCT FROM OLD.subtotal OR NEW.delivery_fee IS DISTINCT FROM OLD.delivery_fee OR NEW.service_fee IS DISTINCT FROM OLD.service_fee) THEN RAISE EXCEPTION 'Immutable POS fiscal fields'; END IF;
  IF OLD.source<>'pos' AND (NEW.source='pos' OR NEW.pos_fiscal_hash IS NOT NULL OR NEW.pos_created_by IS NOT NULL) THEN RAISE EXCEPTION 'POS fiscal fields reserved'; END IF;
  RETURN NEW;
 END IF;
 IF NEW.source<>'pos' THEN IF NEW.pos_fiscal_hash IS NOT NULL OR NEW.pos_created_by IS NOT NULL THEN RAISE EXCEPTION 'POS fiscal fields reserved'; END IF; RETURN NEW; END IF;
 IF NEW.pos_vat IS NULL OR NEW.pos_payments IS NULL OR NEW.pos_created_by IS NULL OR NEW.is_test OR NEW.payment_status<>'paid' THEN RAISE EXCEPTION 'Complete paid POS snapshot required'; END IF;
 INSERT INTO public.pos_integrity_heads(restaurant_id) VALUES(NEW.restaurant_id) ON CONFLICT DO NOTHING;
 SELECT * INTO h FROM public.pos_integrity_heads WHERE restaurant_id=NEW.restaurant_id FOR UPDATE;
 IF NEW.pos_receipt_number<>h.receipt_number+1 THEN RAISE EXCEPTION 'POS integrity sequence mismatch'; END IF;
 payload:=jsonb_build_object('version','lc-pos-integrity-v1','restaurantId',NEW.restaurant_id,'orderId',NEW.id,'number',NEW.pos_receipt_number,'at',NEW.created_at,'sessionId',NEW.pos_session_id,'actorId',NEW.pos_created_by,'items',NEW.items,'subtotal',NEW.subtotal,'discount',NEW.discount,'discountReason',NEW.pos_discount,'total',NEW.total,'vat',NEW.pos_vat,'payments',NEW.pos_payments)::text;
 digest:=encode(extensions.digest(convert_to(h.receipt_hash||E'\n'||payload,'UTF8'),'sha256'),'hex');
 NEW.pos_fiscal_hash:=digest;
 UPDATE public.pos_integrity_heads SET receipt_number=NEW.pos_receipt_number,receipt_hash=digest WHERE restaurant_id=NEW.restaurant_id;
 RETURN NEW;
END $$;
CREATE TRIGGER orders_pos_chain BEFORE INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.pos_chain_receipt();
CREATE FUNCTION public.pos_receipt_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public SET timezone='UTC' AS $$
DECLARE previous text; payload text; BEGIN
 IF NEW.source<>'pos' THEN RETURN NEW; END IF;
 SELECT coalesce((SELECT hash FROM public.pos_fiscal_receipts WHERE restaurant_id=NEW.restaurant_id ORDER BY sequence DESC LIMIT 1),repeat('0',64)) INTO previous;
 payload:=jsonb_build_object('version','lc-pos-integrity-v1','restaurantId',NEW.restaurant_id,'orderId',NEW.id,'number',NEW.pos_receipt_number,'at',NEW.created_at,'sessionId',NEW.pos_session_id,'actorId',NEW.pos_created_by,'items',NEW.items,'subtotal',NEW.subtotal,'discount',NEW.discount,'discountReason',NEW.pos_discount,'total',NEW.total,'vat',NEW.pos_vat,'payments',NEW.pos_payments)::text;
 INSERT INTO public.pos_fiscal_receipts(restaurant_id,order_id,sequence,previous_hash,hash,payload_text) VALUES(NEW.restaurant_id,NEW.id,NEW.pos_receipt_number,previous,NEW.pos_fiscal_hash,payload);
 PERFORM public.pos_append_jet(NEW.restaurant_id,'sale',NEW.pos_created_by,jsonb_build_object('orderId',NEW.id,'number',NEW.pos_receipt_number,'hash',NEW.pos_fiscal_hash));
 IF NEW.discount>0 THEN PERFORM public.pos_append_jet(NEW.restaurant_id,'discount',NEW.pos_created_by,jsonb_build_object('orderId',NEW.id,'amount',NEW.discount,'reason',NEW.pos_discount)); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER orders_pos_evidence AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.pos_receipt_evidence();
CREATE FUNCTION public.pos_session_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'POS session deletion forbidden'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.closed_at IS NOT NULL OR NEW.id IS DISTINCT FROM OLD.id OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id OR NEW.opened_by IS DISTINCT FROM OLD.opened_by OR NEW.opened_at IS DISTINCT FROM OLD.opened_at OR NEW.opening_float IS DISTINCT FROM OLD.opening_float THEN RAISE EXCEPTION 'Immutable POS session'; END IF;
  IF NEW.closed_at IS NULL OR NEW.z_number IS NULL OR NEW.z_report IS NULL OR NEW.closed_by IS NULL OR NEW.counted_cash IS NULL THEN RAISE EXCEPTION 'Atomic Z closure required'; END IF;
  PERFORM public.pos_append_jet(NEW.restaurant_id,'close_z',NEW.closed_by,to_jsonb(NEW));
 ELSE PERFORM public.pos_append_jet(NEW.restaurant_id,'open_session',NEW.opened_by,to_jsonb(NEW)); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pos_sessions_evidence BEFORE INSERT OR UPDATE OR DELETE ON public.pos_sessions FOR EACH ROW EXECUTE FUNCTION public.pos_session_evidence();
CREATE FUNCTION public.pos_cash_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN PERFORM public.pos_append_jet(NEW.restaurant_id,CASE WHEN NEW.kind='void' THEN 'void' ELSE 'cash_'||NEW.kind END,NEW.created_by,to_jsonb(NEW)); RETURN NEW; END $$;
CREATE TRIGGER pos_cash_evidence AFTER INSERT ON public.pos_cash_events FOR EACH ROW EXECUTE FUNCTION public.pos_cash_evidence();
CREATE FUNCTION public.pos_config_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_data jsonb; after_data jsonb; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pos_integrity_heads WHERE restaurant_id=NEW.id) AND coalesce(NEW.enabled_features->>'pos',NEW.config->'pos'->>'enabled','false')<>'true' THEN RETURN NEW; END IF;
 before_data:=jsonb_build_object('config',OLD.config,'menu',OLD.menu,'menuKey',OLD.menu_key,'legal',OLD.legal,'features',OLD.enabled_features,'name',OLD.name,'address',OLD.address);
 after_data:=jsonb_build_object('config',NEW.config,'menu',NEW.menu,'menuKey',NEW.menu_key,'legal',NEW.legal,'features',NEW.enabled_features,'name',NEW.name,'address',NEW.address);
 IF before_data IS DISTINCT FROM after_data THEN PERFORM public.pos_append_jet(NEW.id,'configuration_change',auth.uid(),jsonb_build_object('actorSource',current_user,'beforeHash',encode(extensions.digest(convert_to(before_data::text,'UTF8'),'sha256'),'hex'),'afterHash',encode(extensions.digest(convert_to(after_data::text,'UTF8'),'sha256'),'hex'),'changedFields',(SELECT jsonb_agg(key) FROM jsonb_each(after_data) WHERE value IS DISTINCT FROM before_data->key))); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pos_config_evidence AFTER UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.pos_config_evidence();
CREATE FUNCTION public.pos_integrity_snapshot(_restaurant uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('version','lc-pos-integrity-v1','capturedAt',statement_timestamp(),'restaurant',(SELECT jsonb_build_object('id',id,'name',name,'slug',slug,'address',address,'legal',legal) FROM public.restaurants WHERE id=_restaurant),'head',(SELECT to_jsonb(h) FROM public.pos_integrity_heads h WHERE restaurant_id=_restaurant),'receipts',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY sequence) FROM public.pos_fiscal_receipts r WHERE restaurant_id=_restaurant),'[]'::jsonb),'jet',coalesce((SELECT jsonb_agg(to_jsonb(j) ORDER BY sequence) FROM public.pos_jet j WHERE restaurant_id=_restaurant),'[]'::jsonb),'sessions',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY opened_at,id) FROM public.pos_sessions s WHERE restaurant_id=_restaurant),'[]'::jsonb),'cashEvents',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY created_at,id) FROM public.pos_cash_events e WHERE restaurant_id=_restaurant),'[]'::jsonb),'legacyReceipts',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'number',pos_receipt_number,'createdAt',created_at,'sessionId',pos_session_id,'items',items,'subtotal',subtotal,'total',total,'discount',discount,'vat',pos_vat,'payments',pos_payments,'status',status) ORDER BY pos_receipt_number) FROM public.orders WHERE restaurant_id=_restaurant AND source='pos' AND pos_fiscal_hash IS NULL),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.pos_integrity_snapshot(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.pos_integrity_snapshot(uuid) TO service_role;
CREATE FUNCTION public.pos_archive_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.hash<>encode(extensions.digest(convert_to(NEW.content_text,'UTF8'),'sha256'),'hex') THEN RAISE EXCEPTION 'Archive checksum mismatch'; END IF;
 PERFORM public.pos_append_jet(NEW.restaurant_id,'archive_created',NEW.created_by,jsonb_build_object('archiveId',NEW.id,'hash',NEW.hash)); RETURN NEW;
END $$;
CREATE TRIGGER pos_archive_evidence BEFORE INSERT ON public.pos_fiscal_archives FOR EACH ROW EXECUTE FUNCTION public.pos_archive_evidence();
REVOKE ALL ON FUNCTION public.pos_chain_receipt(),public.pos_receipt_evidence(),public.pos_session_evidence(),public.pos_cash_evidence(),public.pos_config_evidence(),public.pos_archive_evidence(),public.pos_reject_mutation() FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.pos_fiscal_receipts IS 'Technical integrity evidence from installation; not fiscal certification. Legacy tickets are not retroactively certified.';
COMMENT ON TABLE public.pos_fiscal_archives IS 'SHA-256 technical archives retained online; checksum alone is not certification, trusted timestamp or WORM external storage.';