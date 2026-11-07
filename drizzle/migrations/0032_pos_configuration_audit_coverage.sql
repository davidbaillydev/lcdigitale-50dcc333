CREATE OR REPLACE FUNCTION public.pos_config_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE before_data jsonb; after_data jsonb; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.pos_integrity_heads WHERE restaurant_id=NEW.id) AND NOT (coalesce(NEW.enabled_features->>'pos','false')='true' OR coalesce(NEW.config->'pos'->>'enabled','false')='true') THEN RETURN NEW; END IF;
 before_data:=to_jsonb(OLD)-'updated_at';
 after_data:=to_jsonb(NEW)-'updated_at';
 IF before_data IS DISTINCT FROM after_data THEN PERFORM public.pos_append_jet(NEW.id,'configuration_change',auth.uid(),jsonb_build_object('actorSource',CASE WHEN auth.uid() IS NULL THEN 'privileged_server_unattributed' ELSE 'authenticated_user' END,'beforeHash',encode(extensions.digest(convert_to(before_data::text,'UTF8'),'sha256'),'hex'),'afterHash',encode(extensions.digest(convert_to(after_data::text,'UTF8'),'sha256'),'hex'),'changedFields',(SELECT jsonb_agg(key ORDER BY key) FROM jsonb_each(after_data) WHERE value IS DISTINCT FROM before_data->key))); END IF;
 RETURN NEW;
END $$;