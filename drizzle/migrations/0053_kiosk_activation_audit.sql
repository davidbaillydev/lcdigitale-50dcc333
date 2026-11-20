CREATE TABLE public.kiosk_activation_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL,
 restaurant_name text NOT NULL,
 kiosk_id text NOT NULL,
 kiosk_label text NOT NULL,
 active boolean NOT NULL,
 actor_user_id uuid,
 actor_email text,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kiosk_activation_audit TO authenticated;
GRANT ALL ON public.kiosk_activation_audit TO service_role;
ALTER TABLE public.kiosk_activation_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_read_kiosk_audit ON public.kiosk_activation_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX kiosk_activation_audit_restaurant_date ON public.kiosk_activation_audit(restaurant_id,occurred_at DESC,id DESC);
CREATE INDEX kiosk_activation_audit_date ON public.kiosk_activation_audit(occurred_at DESC,id DESC);
CREATE FUNCTION public.audit_kiosk_activation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k jsonb; old_k jsonb; enabled boolean;
BEGIN
 IF NEW.config->'kioskReaders' IS NOT DISTINCT FROM OLD.config->'kioskReaders' THEN RETURN NEW; END IF;
 FOR k IN SELECT value FROM jsonb_array_elements(COALESCE(NEW.config->'kioskReaders','[]'::jsonb)) LOOP
  SELECT value INTO old_k FROM jsonb_array_elements(COALESCE(OLD.config->'kioskReaders','[]'::jsonb)) WHERE value->>'id'=k->>'id' LIMIT 1;
  enabled := COALESCE((k->>'active')::boolean,true);
  IF old_k IS NULL OR enabled IS DISTINCT FROM COALESCE((old_k->>'active')::boolean,true) THEN
   INSERT INTO public.kiosk_activation_audit(restaurant_id,restaurant_name,kiosk_id,kiosk_label,active,actor_user_id,actor_email)
   VALUES(NEW.id,NEW.name,k->>'id',COALESCE(k->>'label','Borne '||(k->>'id')),enabled,auth.uid(),auth.jwt()->>'email');
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER restaurant_kiosk_activation_audit AFTER UPDATE OF config ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.audit_kiosk_activation();
CREATE FUNCTION public.reject_kiosk_audit_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'Journal des bornes immuable'; END $$;
CREATE TRIGGER kiosk_audit_immutable BEFORE UPDATE OR DELETE ON public.kiosk_activation_audit FOR EACH ROW EXECUTE FUNCTION public.reject_kiosk_audit_mutation();
REVOKE ALL ON FUNCTION public.audit_kiosk_activation() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reject_kiosk_audit_mutation() FROM PUBLIC,anon,authenticated;