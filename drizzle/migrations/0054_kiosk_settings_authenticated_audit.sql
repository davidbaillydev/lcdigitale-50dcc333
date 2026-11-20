CREATE FUNCTION public.agency_save_kiosk_readers(_restaurant uuid, _kiosks jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Réservé à l’agence'; END IF;
 IF _kiosks IS NULL OR jsonb_typeof(_kiosks) <> 'array' THEN RAISE EXCEPTION 'Liste de bornes invalide'; END IF;
 IF jsonb_array_length(_kiosks)>20 OR EXISTS(SELECT 1 FROM jsonb_array_elements(_kiosks) k WHERE k->>'id' IS NULL OR k->>'id' !~ '^[a-z0-9-]{1,20}$' OR length(COALESCE(k->>'label',''))>40 OR length(COALESCE(k->>'reader',''))>80 OR COALESCE(k->>'reader','') !~ '^[A-Za-z0-9_-]*$' OR (k ? 'active' AND jsonb_typeof(k->'active') <> 'boolean')) THEN RAISE EXCEPTION 'Borne invalide'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(_kiosks)) <> (SELECT count(DISTINCT k->>'id') FROM jsonb_array_elements(_kiosks) k) THEN RAISE EXCEPTION 'Identifiant dupliqué'; END IF;
 SELECT config INTO cfg FROM public.restaurants WHERE id=_restaurant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant introuvable'; END IF;
 UPDATE public.restaurants SET config=CASE WHEN jsonb_array_length(_kiosks)=0 THEN cfg-'kioskReaders' ELSE jsonb_set(cfg,'{kioskReaders}',_kiosks) END, updated_at=now() WHERE id=_restaurant;
END $$;
REVOKE ALL ON FUNCTION public.agency_save_kiosk_readers(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agency_save_kiosk_readers(uuid,jsonb) TO authenticated;