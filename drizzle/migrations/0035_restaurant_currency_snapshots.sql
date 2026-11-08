ALTER TABLE public.orders ADD COLUMN currency text NOT NULL DEFAULT 'EUR';
ALTER TABLE public.orders ADD CONSTRAINT orders_currency_supported CHECK (currency IN ('EUR','XOF','XAF','CDF','USD'));
CREATE OR REPLACE FUNCTION public.snapshot_order_currency() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT coalesce(config->>'currency','EUR') INTO NEW.currency FROM public.restaurants WHERE id=NEW.restaurant_id;
 ELSIF NEW.currency IS DISTINCT FROM OLD.currency THEN RAISE EXCEPTION 'Order currency is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER orders_currency_snapshot BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_currency();
CREATE OR REPLACE FUNCTION public.guard_restaurant_currency() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF coalesce(NEW.config->>'currency','EUR') NOT IN ('EUR','XOF','XAF','CDF','USD') THEN RAISE EXCEPTION 'Unsupported currency'; END IF;
 IF TG_OP='UPDATE' AND coalesce(NEW.config->>'currency','EUR') IS DISTINCT FROM coalesce(OLD.config->>'currency','EUR') AND EXISTS(SELECT 1 FROM public.orders WHERE restaurant_id=OLD.id) THEN
  RAISE EXCEPTION 'Devise non modifiable : cet établissement possède déjà des commandes. Créez un établissement distinct pour une autre devise.';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER restaurants_currency_guard BEFORE INSERT OR UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.guard_restaurant_currency();
COMMENT ON COLUMN public.orders.currency IS 'Immutable restaurant currency snapshot; historical orders remain EUR.';