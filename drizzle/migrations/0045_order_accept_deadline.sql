ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS accept_deadline timestamptz, ADD COLUMN IF NOT EXISTS missed_at timestamptz;
CREATE INDEX IF NOT EXISTS orders_accept_deadline_idx ON public.orders (accept_deadline) WHERE status = 'new' AND missed_at IS NULL;

CREATE OR REPLACE FUNCTION public.orders_accept_deadline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Website orders only: 4 minutes to accept from the moment the kitchen can see them.
  IF NEW.status = 'new' AND NEW.accept_deadline IS NULL AND NOT COALESCE(NEW.is_test, false)
     AND NEW.source IN ('web','embed','facebook','link')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'new') THEN
    NEW.accept_deadline := now() + interval '4 minutes';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'new' AND NEW.status NOT IN ('new','cancelled')
     AND OLD.accept_deadline IS NOT NULL AND (OLD.missed_at IS NOT NULL OR now() > OLD.accept_deadline + interval '5 seconds') THEN
    RAISE EXCEPTION 'Délai d''acceptation de 4 minutes dépassé : commande manquée.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS orders_accept_deadline_trg ON public.orders;
CREATE TRIGGER orders_accept_deadline_trg BEFORE INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_accept_deadline();