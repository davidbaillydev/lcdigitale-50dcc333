CREATE TABLE public.restaurant_deletion_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL, restaurant_name text NOT NULL, restaurant_slug text NOT NULL, deleted_by uuid NOT NULL, deleted_at timestamptz NOT NULL DEFAULT now(), deleted_orders integer NOT NULL, approved_test_cleanup boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.restaurant_deletion_audit TO authenticated;
GRANT ALL ON public.restaurant_deletion_audit TO service_role;
ALTER TABLE public.restaurant_deletion_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY deletion_audit_agency ON public.restaurant_deletion_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.approved_restaurant_test_cleanup(_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(current_setting('lc.restaurant_cleanup',true),'')=_id::text AND public.has_role(auth.uid(),'admin') AND EXISTS (
 SELECT 1 FROM public.restaurants r WHERE r.id=_id AND NOT r.active AND (r.id,r.slug,r.name) IN (
 ('00000000-0000-4000-8000-00000000cb01'::uuid,'verification-cb-admin','TEST ADMIN CB — Vérification'),
 ('7ce5932a-1a7b-4707-a8bb-1d87cd9b3650'::uuid,'verification-caisse-20261107','Vérification caisse avancée — TEST'),
 ('25bdf14e-05b8-4686-ad58-db401cd77ad7'::uuid,'test-integrite-caisse','TEST Intégrité Caisse')))
 AND NOT EXISTS (SELECT 1 FROM public.orders WHERE restaurant_id=_id AND payment_ref IS NOT NULL AND payment_ref NOT LIKE 'admin-test:%')
 AND NOT EXISTS (SELECT 1 FROM public.orders WHERE restaurant_id=_id AND NOT is_test AND source<>'pos')
 AND NOT EXISTS (SELECT 1 FROM public.restaurant_invoices WHERE restaurant_id=_id)
 AND NOT EXISTS (SELECT 1 FROM public.order_refunds WHERE restaurant_id=_id);
$$;
REVOKE ALL ON FUNCTION public.approved_restaurant_test_cleanup(uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.pos_guard_test_evidence_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF public.approved_restaurant_test_cleanup(OLD.restaurant_id) THEN RETURN OLD; END IF;
 RAISE EXCEPTION 'Immutable fiscal evidence'; END $$;
REVOKE ALL ON FUNCTION public.pos_guard_test_evidence_delete() FROM PUBLIC,anon,authenticated;
DROP TRIGGER pos_receipts_immutable ON public.pos_fiscal_receipts;
DROP TRIGGER pos_jet_immutable ON public.pos_jet;
DROP TRIGGER pos_archives_immutable ON public.pos_fiscal_archives;
CREATE TRIGGER pos_receipts_immutable BEFORE UPDATE OR TRUNCATE ON public.pos_fiscal_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.pos_reject_mutation();
CREATE TRIGGER pos_jet_immutable BEFORE UPDATE OR TRUNCATE ON public.pos_jet FOR EACH STATEMENT EXECUTE FUNCTION public.pos_reject_mutation();
CREATE TRIGGER pos_archives_immutable BEFORE UPDATE OR TRUNCATE ON public.pos_fiscal_archives FOR EACH STATEMENT EXECUTE FUNCTION public.pos_reject_mutation();
CREATE TRIGGER pos_receipts_delete_guard BEFORE DELETE ON public.pos_fiscal_receipts FOR EACH ROW EXECUTE FUNCTION public.pos_guard_test_evidence_delete();
CREATE TRIGGER pos_jet_delete_guard BEFORE DELETE ON public.pos_jet FOR EACH ROW EXECUTE FUNCTION public.pos_guard_test_evidence_delete();
CREATE TRIGGER pos_archives_delete_guard BEFORE DELETE ON public.pos_fiscal_archives FOR EACH ROW EXECUTE FUNCTION public.pos_guard_test_evidence_delete();
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.pos_chain_receipt()'::regprocedure);
 definition:=replace(definition,'IF TG_OP=''DELETE'' THEN IF OLD.source=''pos''','IF TG_OP=''DELETE'' THEN IF public.approved_restaurant_test_cleanup(OLD.restaurant_id) THEN RETURN OLD; END IF; IF OLD.source=''pos''');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.pos_session_evidence()'::regprocedure);
 definition:=replace(definition,'IF TG_OP=''DELETE'' THEN RAISE','IF TG_OP=''DELETE'' THEN IF public.approved_restaurant_test_cleanup(OLD.restaurant_id) THEN RETURN OLD; END IF; RAISE');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.pos_open_session_lock()'::regprocedure);
 definition:=replace(definition,'IF TG_OP<>''INSERT'' THEN','IF TG_OP=''DELETE'' AND public.approved_restaurant_test_cleanup(OLD.restaurant_id) THEN RETURN OLD; END IF; IF TG_OP<>''INSERT'' THEN');
 EXECUTE definition;
END $$;
CREATE FUNCTION public.delete_agency_restaurant(_id uuid,_confirmation text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.restaurants; approved boolean; n integer; BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Réservé à un administrateur agence'; END IF;
 SELECT * INTO r FROM public.restaurants WHERE id=_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant introuvable'; END IF;
 IF _confirmation IS NULL OR _confirmation<>r.name THEN RAISE EXCEPTION 'Saisissez le nom exact du restaurant'; END IF;
 PERFORM set_config('lc.restaurant_cleanup',_id::text,true);
 approved:=public.approved_restaurant_test_cleanup(_id);
 IF EXISTS(SELECT 1 FROM public.restaurant_invoices WHERE restaurant_id=_id) OR EXISTS(SELECT 1 FROM public.order_refunds WHERE restaurant_id=_id)
 OR EXISTS(SELECT 1 FROM public.kiosk_license_billing WHERE license_id IN (SELECT id FROM public.kiosk_licenses WHERE restaurant_id=_id))
 OR (NOT approved AND (EXISTS(SELECT 1 FROM public.orders WHERE restaurant_id=_id AND NOT is_test) OR EXISTS(SELECT 1 FROM public.pos_sessions WHERE restaurant_id=_id) OR EXISTS(SELECT 1 FROM public.pos_fiscal_receipts WHERE restaurant_id=_id) OR EXISTS(SELECT 1 FROM public.pos_jet WHERE restaurant_id=_id) OR EXISTS(SELECT 1 FROM public.pos_fiscal_archives WHERE restaurant_id=_id)))
 THEN RAISE EXCEPTION 'Suppression bloquée : historique commercial ou fiscal à conserver. Désactivez ce restaurant.'; END IF;
 SELECT count(*) INTO n FROM public.orders WHERE restaurant_id=_id;
 INSERT INTO public.restaurant_deletion_audit(restaurant_id,restaurant_name,restaurant_slug,deleted_by,deleted_orders,approved_test_cleanup) VALUES(_id,r.name,r.slug,auth.uid(),n,approved);
 IF approved THEN
 DELETE FROM public.pos_fiscal_archives WHERE restaurant_id=_id;
 DELETE FROM public.pos_fiscal_receipts WHERE restaurant_id=_id;
 DELETE FROM public.pos_jet WHERE restaurant_id=_id;
 DELETE FROM public.pos_cash_events WHERE restaurant_id=_id;
 DELETE FROM public.pos_parked_carts WHERE restaurant_id=_id;
 END IF;
 DELETE FROM public.order_notification_deliveries WHERE order_id IN (SELECT id FROM public.orders WHERE restaurant_id=_id);
 DELETE FROM public.orders WHERE restaurant_id=_id;
 IF approved THEN DELETE FROM public.pos_sessions WHERE restaurant_id=_id; END IF;
 DELETE FROM public.pos_receipt_counters WHERE restaurant_id=_id;
 DELETE FROM public.pos_integrity_heads WHERE restaurant_id=_id;
 DELETE FROM public.kiosk_licenses WHERE restaurant_id=_id;
 DELETE FROM public.restaurants WHERE id=_id;
 PERFORM set_config('lc.restaurant_cleanup','',true);
 RETURN jsonb_build_object('ok',true,'deletedOrders',n);
END $$;
REVOKE ALL ON FUNCTION public.delete_agency_restaurant(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_agency_restaurant(uuid,text) TO authenticated;
COMMENT ON FUNCTION public.delete_agency_restaurant(uuid,text) IS 'Atomic agency deletion with exact-name confirmation. Real commercial/fiscal history blocks deletion. Narrow exceptions only for the three explicitly approved legacy test restaurants; no global trigger bypass.';