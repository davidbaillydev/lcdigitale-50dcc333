ALTER TABLE public.kiosk_licenses ADD COLUMN archived_at timestamptz;
CREATE FUNCTION public.agency_save_licensed_kiosk(_restaurant uuid, _previous text, _kiosk text, _label text, _reader text, _starts date, _status text, _notes text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb; kiosks jsonb; lid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Réservé à l’agence'; END IF;
 IF _kiosk IS NULL OR _kiosk !~ '^[a-z0-9-]{1,20}$' OR _label IS NULL OR length(_label)>40 OR _reader IS NULL OR length(_reader)>80 OR _reader !~ '^[A-Za-z0-9_-]*$' OR _starts IS NULL OR _status IS NULL OR _status NOT IN ('active','suspended','ended') OR _notes IS NULL OR length(_notes)>2000 THEN RAISE EXCEPTION 'Données de borne invalides'; END IF;
 SELECT config INTO cfg FROM public.restaurants WHERE id=_restaurant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant introuvable'; END IF;
 kiosks := COALESCE(cfg->'kioskReaders','[]'::jsonb);
 IF _previous IS NULL THEN
  lid := public.agency_register_kiosk(_restaurant,_kiosk,_label,_starts);
  SELECT config INTO cfg FROM public.restaurants WHERE id=_restaurant;
  kiosks := cfg->'kioskReaders';
 ELSE
  SELECT id INTO lid FROM public.kiosk_licenses WHERE restaurant_id=_restaurant AND kiosk_id=_previous AND archived_at IS NULL FOR UPDATE;
  IF lid IS NULL AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(kiosks) k WHERE k->>'id'=_previous) THEN RAISE EXCEPTION 'Borne introuvable ou archivée'; END IF;
  IF _kiosk<>_previous AND (EXISTS(SELECT 1 FROM jsonb_array_elements(kiosks) k WHERE k->>'id'=_kiosk) OR EXISTS(SELECT 1 FROM public.kiosk_licenses WHERE restaurant_id=_restaurant AND kiosk_id=_kiosk)) THEN RAISE EXCEPTION 'Identifiant déjà utilisé'; END IF;
  IF lid IS NULL THEN
   INSERT INTO public.kiosk_licenses(restaurant_id,kiosk_id,label,status,starts_on,ends_on,notes,updated_by) VALUES(_restaurant,_kiosk,_label,_status,_starts,(_starts+interval '1 year')::date,_notes,auth.uid()) RETURNING id INTO lid;
   INSERT INTO public.kiosk_license_billing(license_id,starts_on,ends_on,amount_ht_cents,status,updated_by) VALUES(lid,_starts,(_starts+interval '1 year')::date,40000,'to_invoice',auth.uid());
  END IF;
 END IF;
 UPDATE public.kiosk_licenses SET kiosk_id=_kiosk,label=_label,status=_status,starts_on=_starts,ends_on=(_starts+interval '1 year')::date,notes=_notes,updated_by=auth.uid(),updated_at=now() WHERE id=lid;
 SELECT COALESCE(jsonb_agg(CASE WHEN k->>'id'=COALESCE(_previous,_kiosk) THEN k || jsonb_build_object('id',_kiosk,'label',_label,'reader',_reader) ELSE k END ORDER BY ord),'[]'::jsonb) INTO kiosks FROM jsonb_array_elements(kiosks) WITH ORDINALITY AS t(k,ord);
 UPDATE public.restaurants SET config=jsonb_set(cfg,'{kioskReaders}',kiosks),updated_at=now() WHERE id=_restaurant;
 RETURN lid;
END $$;
REVOKE ALL ON FUNCTION public.agency_save_licensed_kiosk(uuid,text,text,text,text,date,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agency_save_licensed_kiosk(uuid,text,text,text,text,date,text,text) TO authenticated;
CREATE FUNCTION public.agency_remove_licensed_kiosk(_restaurant uuid,_kiosk text,_confirmation text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cfg jsonb; kiosks jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Réservé à l’agence'; END IF;
 IF _kiosk IS NULL OR _confirmation IS DISTINCT FROM _kiosk THEN RAISE EXCEPTION 'Confirmation incorrecte'; END IF;
 SELECT config INTO cfg FROM public.restaurants WHERE id=_restaurant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant introuvable'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(cfg->'kioskReaders','[]'::jsonb)) k WHERE k->>'id'=_kiosk) AND NOT EXISTS(SELECT 1 FROM public.kiosk_licenses WHERE restaurant_id=_restaurant AND kiosk_id=_kiosk AND archived_at IS NULL) THEN RAISE EXCEPTION 'Borne introuvable'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(cfg->'kioskReaders','[]'::jsonb)) k WHERE k->>'id'=_kiosk AND COALESCE((k->>'active')::boolean,true)) THEN
  PERFORM public.agency_set_kiosk_active(_restaurant,_kiosk,false);
  SELECT config INTO cfg FROM public.restaurants WHERE id=_restaurant;
 END IF;
 SELECT COALESCE(jsonb_agg(k ORDER BY ord),'[]'::jsonb) INTO kiosks FROM jsonb_array_elements(COALESCE(cfg->'kioskReaders','[]'::jsonb)) WITH ORDINALITY AS t(k,ord) WHERE k->>'id'<>_kiosk;
 UPDATE public.restaurants SET config=jsonb_set(cfg,'{kioskReaders}',kiosks),updated_at=now() WHERE id=_restaurant;
 UPDATE public.kiosk_licenses SET status='ended',archived_at=now(),updated_at=now(),updated_by=auth.uid() WHERE restaurant_id=_restaurant AND kiosk_id=_kiosk AND archived_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.agency_remove_licensed_kiosk(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.agency_remove_licensed_kiosk(uuid,text,text) TO authenticated;