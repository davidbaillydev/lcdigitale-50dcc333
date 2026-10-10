ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE public.orders ALTER COLUMN source SET DEFAULT 'web';
COMMENT ON COLUMN public.orders.source_ref IS 'Hostname du site parent (bouton intégré), facultatif — jamais l''URL complète';