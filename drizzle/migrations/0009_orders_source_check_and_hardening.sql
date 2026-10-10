ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_source_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_source_check CHECK (source IN ('web','kiosk','phone','embed','facebook','link','qr'));
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE (status, slot, updated_at, driver_id, courier_status, courier_name) ON public.orders TO authenticated;