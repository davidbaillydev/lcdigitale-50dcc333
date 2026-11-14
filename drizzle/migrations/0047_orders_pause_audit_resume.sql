CREATE TABLE public.restaurant_order_availability_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE, action text NOT NULL CHECK (action IN ('suspended','resumed','auto_resumed')), actor_user_id uuid, actor_email text, occurred_at timestamptz NOT NULL DEFAULT now(), resume_at timestamptz);
GRANT SELECT ON public.restaurant_order_availability_audit TO authenticated;
GRANT ALL ON public.restaurant_order_availability_audit TO service_role;
ALTER TABLE public.restaurant_order_availability_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurant team reads availability history" ON public.restaurant_order_availability_audit FOR SELECT TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));
CREATE INDEX restaurant_availability_history_idx ON public.restaurant_order_availability_audit(restaurant_id, occurred_at DESC);
CREATE FUNCTION public.next_order_service(_opening jsonb, _now timestamptz) RETURNS timestamptz LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE local_day date := (_now AT TIME ZONE 'Europe/Paris')::date; candidate timestamptz; result timestamptz; service_range jsonb; service_day date; i integer;
BEGIN
 FOR i IN 0..7 LOOP
  service_day := local_day + i;
  FOR service_range IN SELECT value FROM jsonb_array_elements(COALESCE(_opening->(extract(dow FROM service_day)::integer::text), '[]'::jsonb)) LOOP
   candidate := (service_day::timestamp + make_interval(mins => (service_range->>0)::integer)) AT TIME ZONE 'Europe/Paris';
   IF candidate > _now AND (result IS NULL OR candidate < result) THEN result := candidate; END IF;
  END LOOP;
 END LOOP;
 RETURN COALESCE(result, ((local_day + 1)::timestamp AT TIME ZONE 'Europe/Paris'));
END $$;
CREATE FUNCTION public.audit_order_availability() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE was_paused boolean := COALESCE((OLD.config->>'ordersPaused')::boolean,false); is_paused boolean := COALESCE((NEW.config->>'ordersPaused')::boolean,false); deadline timestamptz; actor uuid := auth.uid(); email text; automatic boolean := COALESCE(current_setting('app.auto_resume_orders',true),'') = 'true';
BEGIN
 IF was_paused = is_paused THEN
  IF is_paused AND OLD.config ? 'ordersResumeAt' THEN NEW.config := jsonb_set(NEW.config, '{ordersResumeAt}', OLD.config->'ordersResumeAt'); ELSE NEW.config := NEW.config - 'ordersResumeAt'; END IF;
  RETURN NEW;
 END IF;
 IF actor IS NOT NULL THEN SELECT u.email INTO email FROM auth.users u WHERE u.id = actor; END IF;
 IF is_paused THEN deadline := public.next_order_service(NEW.opening,now()); NEW.config := jsonb_set(NEW.config,'{ordersResumeAt}',to_jsonb(deadline)); ELSE NEW.config := NEW.config - 'ordersResumeAt'; END IF;
 INSERT INTO public.restaurant_order_availability_audit(restaurant_id,action,actor_user_id,actor_email,resume_at) VALUES(NEW.id,CASE WHEN is_paused THEN 'suspended' WHEN automatic THEN 'auto_resumed' ELSE 'resumed' END,actor,email,deadline);
 RETURN NEW;
END $$;
CREATE TRIGGER restaurant_order_availability_audit BEFORE UPDATE OF config ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.audit_order_availability();
CREATE FUNCTION public.set_orders_paused(_restaurant_id uuid,_paused boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.can_access_restaurant(auth.uid(),_restaurant_id) THEN RAISE EXCEPTION 'Accès refusé' USING ERRCODE='42501'; END IF;
 UPDATE public.restaurants SET config=jsonb_set(COALESCE(config,'{}'::jsonb),'{ordersPaused}',to_jsonb(_paused)) WHERE id=_restaurant_id RETURNING config INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Restaurant introuvable'; END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.set_orders_paused(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_orders_paused(uuid,boolean) TO authenticated;
CREATE FUNCTION public.resume_due_order_availability() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
 PERFORM set_config('app.auto_resume_orders','true',true);
 UPDATE public.restaurants SET config=jsonb_set(config,'{ordersPaused}','false'::jsonb) WHERE config->>'ordersPaused'='true' AND (config->>'ordersResumeAt')::timestamptz <= now();
 GET DIAGNOSTICS affected=ROW_COUNT;
 PERFORM set_config('app.auto_resume_orders','false',true);
 RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.resume_due_order_availability() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resume_due_order_availability() TO service_role;
REVOKE ALL ON FUNCTION public.audit_order_availability() FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.restaurant_order_availability_audit IS 'Append-only transitions; automatic events have no invented email. Legacy suspended restaurants retain their existing state until a manual transition.';