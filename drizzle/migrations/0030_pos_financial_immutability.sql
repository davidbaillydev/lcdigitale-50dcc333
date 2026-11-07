CREATE OR REPLACE FUNCTION public.pos_sale_financial_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF OLD.source='pos' AND (NEW.total IS DISTINCT FROM OLD.total OR NEW.discount IS DISTINCT FROM OLD.discount OR NEW.items IS DISTINCT FROM OLD.items OR NEW.pos_payments IS DISTINCT FROM OLD.pos_payments OR NEW.pos_discount IS DISTINCT FROM OLD.pos_discount OR NEW.pos_vat IS DISTINCT FROM OLD.pos_vat OR NEW.pos_tender IS DISTINCT FROM OLD.pos_tender OR NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.source IS DISTINCT FROM OLD.source) THEN RAISE EXCEPTION 'Immutable POS sale'; END IF;
 IF OLD.source='pos' AND OLD.status='cancelled' AND NEW.status<>'cancelled' THEN RAISE EXCEPTION 'Cancelled POS sale is immutable'; END IF;
 IF OLD.source='pos' AND NEW.status='cancelled' AND OLD.status<>'cancelled' THEN
  PERFORM id FROM public.pos_sessions WHERE id=OLD.pos_session_id AND closed_at IS NULL FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.pos_cash_events WHERE order_id=OLD.id AND kind='void') THEN RAISE EXCEPTION 'Annulation responsable avec motif requise'; END IF;
 END IF;
 RETURN NEW; END $$;