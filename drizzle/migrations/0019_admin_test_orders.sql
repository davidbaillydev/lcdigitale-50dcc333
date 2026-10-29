ALTER TABLE public.orders ADD COLUMN is_test boolean NOT NULL DEFAULT false, ADD COLUMN test_created_by uuid, ADD COLUMN test_created_at timestamptz;
COMMENT ON COLUMN public.orders.is_test IS 'Agency-only operational test: simulated card payment, no bank, revenue, fiscal invoice, POS or customer email.';
CREATE FUNCTION public.guard_order_test_marker() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.is_test AND coalesce(auth.role(), '') <> 'service_role' THEN RAISE EXCEPTION 'Test orders require the verified agency server'; END IF;
  IF NEW.is_test AND (NEW.test_created_by IS NULL OR NEW.test_created_at IS NULL OR NEW.payment_method <> 'online' OR NEW.payment_status <> 'paid' OR NEW.payment_ref NOT LIKE 'admin-test:%') THEN RAISE EXCEPTION 'Incomplete simulated payment audit'; END IF;
  IF NOT NEW.is_test AND (NEW.test_created_by IS NOT NULL OR NEW.test_created_at IS NOT NULL OR NEW.payment_ref LIKE 'admin-test:%') THEN RAISE EXCEPTION 'Invalid simulated payment marker'; END IF;
 ELSE
  IF NEW.is_test IS DISTINCT FROM OLD.is_test OR NEW.test_created_by IS DISTINCT FROM OLD.test_created_by OR NEW.test_created_at IS DISTINCT FROM OLD.test_created_at THEN RAISE EXCEPTION 'Order test marker is immutable'; END IF;
  IF OLD.is_test AND (NEW.payment_method IS DISTINCT FROM OLD.payment_method OR NEW.payment_ref IS DISTINCT FROM OLD.payment_ref OR NEW.payment_status IS DISTINCT FROM OLD.payment_status) THEN RAISE EXCEPTION 'Simulated payment cannot become a bank payment'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER orders_guard_test_marker BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_order_test_marker();