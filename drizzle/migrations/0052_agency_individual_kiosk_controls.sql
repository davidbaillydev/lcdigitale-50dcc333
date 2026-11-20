CREATE OR REPLACE FUNCTION public.agency_set_kiosk_active(_restaurant uuid, _kiosk text, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg jsonb; kiosks jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé à l’agence'; END IF;
 SELECT config INTO cfg FROM public.restaurants WHERE id = _restaurant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant introuvable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(cfg->'kioskReaders', '[]'::jsonb)) k WHERE k->>'id' = _kiosk) THEN RAISE EXCEPTION 'Borne non déclarée'; END IF;
 SELECT jsonb_agg(CASE WHEN k->>'id' = _kiosk THEN jsonb_set(k, '{active}', to_jsonb(_active)) ELSE k END ORDER BY ord) INTO kiosks FROM jsonb_array_elements(cfg->'kioskReaders') WITH ORDINALITY AS t(k,ord);
 UPDATE public.restaurants SET config = jsonb_set(cfg, '{kioskReaders}', kiosks), updated_at = now() WHERE id = _restaurant;
END $$;
REVOKE ALL ON FUNCTION public.agency_set_kiosk_active(uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_set_kiosk_active(uuid,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.agency_register_kiosk(_restaurant uuid, _kiosk text, _label text, _starts date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cfg jsonb; kiosks jsonb; lid uuid; ends date;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé à l’agence'; END IF;
 IF _kiosk IS NULL OR _kiosk !~ '^[a-z0-9-]{1,20}$' OR _label IS NULL OR length(_label) > 40 OR _starts IS NULL THEN RAISE EXCEPTION 'Données de borne invalides'; END IF;
 SELECT config INTO cfg FROM public.restaurants WHERE id = _restaurant FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant introuvable'; END IF;
 kiosks := COALESCE(cfg->'kioskReaders', '[]'::jsonb);
 IF jsonb_array_length(kiosks) >= 20 THEN RAISE EXCEPTION 'Limite de bornes atteinte'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(kiosks) k WHERE k->>'id' = _kiosk) OR EXISTS (SELECT 1 FROM public.kiosk_licenses WHERE restaurant_id = _restaurant AND kiosk_id = _kiosk) THEN RAISE EXCEPTION 'Identifiant de borne déjà utilisé'; END IF;
 ends := (_starts + interval '1 year')::date;
 INSERT INTO public.kiosk_licenses(restaurant_id,kiosk_id,label,status,starts_on,ends_on,notes,updated_by) VALUES (_restaurant,_kiosk,_label,'active',_starts,ends,'',auth.uid()) RETURNING id INTO lid;
 INSERT INTO public.kiosk_license_billing(license_id,starts_on,ends_on,amount_ht_cents,status,updated_by) VALUES (lid,_starts,ends,40000,'to_invoice',auth.uid());
 UPDATE public.restaurants SET config = jsonb_set(cfg,'{kioskReaders}',kiosks || jsonb_build_array(jsonb_build_object('id',_kiosk,'label',_label,'reader','','active',true))), updated_at = now() WHERE id = _restaurant;
 RETURN lid;
END $$;
REVOKE ALL ON FUNCTION public.agency_register_kiosk(uuid,text,text,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.agency_register_kiosk(uuid,text,text,date) TO authenticated;