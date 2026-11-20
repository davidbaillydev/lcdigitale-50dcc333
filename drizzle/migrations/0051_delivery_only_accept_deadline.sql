CREATE OR REPLACE FUNCTION public.orders_accept_deadline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.mode <> 'delivery' THEN
    NEW.accept_deadline := NULL;
    RETURN NEW;
  END IF;
  IF NEW.status = 'new' AND NEW.accept_deadline IS NULL AND NOT COALESCE(NEW.is_test, false)
     AND NEW.source IN ('web','embed','facebook','link')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'new') THEN
    NEW.accept_deadline := now() + interval '300 seconds';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.mode = 'delivery' AND OLD.status = 'new' AND NEW.status NOT IN ('new','cancelled')
     AND OLD.accept_deadline IS NOT NULL AND (OLD.missed_at IS NOT NULL OR now() >= OLD.accept_deadline) THEN
    RAISE EXCEPTION 'Délai d''acceptation de 5 minutes dépassé : commande manquée.';
  END IF;
  RETURN NEW;
END $$;