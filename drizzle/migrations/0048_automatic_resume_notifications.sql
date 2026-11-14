CREATE TABLE public.restaurant_availability_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 audit_id uuid NOT NULL REFERENCES public.restaurant_order_availability_audit(id) ON DELETE CASCADE,
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 occurred_at timestamptz NOT NULL,
 read_at timestamptz,
 UNIQUE(audit_id,user_id)
);
GRANT SELECT ON public.restaurant_availability_notifications TO authenticated;
GRANT ALL ON public.restaurant_availability_notifications TO service_role;
ALTER TABLE public.restaurant_availability_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers read their own resume notifications" ON public.restaurant_availability_notifications FOR SELECT TO authenticated USING(user_id=auth.uid() AND public.is_restaurant_manager(auth.uid(),restaurant_id));
CREATE INDEX availability_notifications_unread ON public.restaurant_availability_notifications(user_id,occurred_at) WHERE read_at IS NULL;
CREATE FUNCTION public.notify_automatic_order_resume() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.action <> 'auto_resumed' THEN RETURN NEW; END IF;
 INSERT INTO public.restaurant_availability_notifications(audit_id,restaurant_id,user_id,occurred_at)
 SELECT NEW.id,NEW.restaurant_id,m.user_id,NEW.occurred_at FROM public.restaurant_members m WHERE m.restaurant_id=NEW.restaurant_id AND m.role='manager'
 UNION SELECT NEW.id,NEW.restaurant_id,u.user_id,NEW.occurred_at FROM public.user_roles u WHERE u.role='admin'
 ON CONFLICT(audit_id,user_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.notify_automatic_order_resume() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER notify_automatic_order_resume AFTER INSERT ON public.restaurant_order_availability_audit FOR EACH ROW EXECUTE FUNCTION public.notify_automatic_order_resume();
CREATE FUNCTION public.consume_availability_notifications() RETURNS TABLE(id uuid,restaurant_id uuid,restaurant_name text,restaurant_slug text,occurred_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 WITH pending AS (
 SELECT n.id FROM public.restaurant_availability_notifications n
 WHERE auth.uid() IS NOT NULL AND n.user_id=auth.uid() AND n.read_at IS NULL AND public.is_restaurant_manager(auth.uid(),n.restaurant_id)
 ORDER BY n.occurred_at,n.id LIMIT 50 FOR UPDATE SKIP LOCKED
 ), claimed AS (
 UPDATE public.restaurant_availability_notifications n SET read_at=now() FROM pending p WHERE n.id=p.id
 RETURNING n.id,n.restaurant_id,n.occurred_at
 ) SELECT c.id,c.restaurant_id,r.name,r.slug,c.occurred_at FROM claimed c JOIN public.restaurants r ON r.id=c.restaurant_id ORDER BY c.occurred_at,c.id;
$$;
REVOKE ALL ON FUNCTION public.consume_availability_notifications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.consume_availability_notifications() TO authenticated;
COMMENT ON TABLE public.restaurant_availability_notifications IS 'Per-recipient automatic-resume inbox; manual transitions never enqueue. Current manager access rechecked on read/claim.';