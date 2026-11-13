ALTER TABLE public.restaurant_sms_campaigns ADD COLUMN remaining_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE public.restaurant_sms_campaigns SET remaining_ids = customer_ids;
CREATE OR REPLACE FUNCTION public.freeze_sms_campaign_snapshot() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  NEW.remaining_ids := NEW.customer_ids;
 ELSIF NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id OR NEW.name IS DISTINCT FROM OLD.name OR NEW.sender IS DISTINCT FROM OLD.sender OR NEW.content IS DISTINCT FROM OLD.content OR NEW.customer_ids IS DISTINCT FROM OLD.customer_ids OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
  RAISE EXCEPTION 'SMS campaign snapshot is immutable';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER freeze_sms_campaign_snapshot BEFORE INSERT OR UPDATE ON public.restaurant_sms_campaigns FOR EACH ROW EXECUTE FUNCTION public.freeze_sms_campaign_snapshot();