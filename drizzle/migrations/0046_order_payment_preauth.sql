ALTER TABLE public.orders DROP CONSTRAINT orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('pending','authorized','paid','failed','expired','refunded','partially_refunded','released'));

CREATE OR REPLACE FUNCTION public.orders_preauth_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- A pre-authorized order can only move forward once the server has captured the payment.
  IF NEW.payment_status = 'authorized' AND NEW.status IN ('accepted','ready','done','no_show') THEN
    RAISE EXCEPTION 'Paiement pré-autorisé : acceptation via la capture serveur uniquement.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS orders_preauth_guard_trg ON public.orders;
CREATE TRIGGER orders_preauth_guard_trg BEFORE INSERT OR UPDATE OF status, payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_preauth_guard();