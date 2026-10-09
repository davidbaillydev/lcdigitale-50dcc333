ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS enabled_features jsonb NOT NULL DEFAULT '{"borne":true,"kds":true,"livraison":true,"reservation":true,"qrcode":true,"facturx":true,"pos_sync":true,"borne_cash_payment":true}'::jsonb;
COMMENT ON COLUMN public.restaurants.enabled_features IS 'Modules activés par l''agence (écriture serveur agence uniquement).';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='restaurants') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
  END IF;
END $$;