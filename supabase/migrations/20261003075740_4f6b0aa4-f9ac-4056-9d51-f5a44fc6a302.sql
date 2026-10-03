DROP POLICY IF EXISTS "Brand logos public read" ON storage.objects;
DROP POLICY IF EXISTS "Agency uploads logos" ON storage.objects;
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND (qual ILIKE '%brand%' OR with_check ILIKE '%brand%') LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', p.policyname);
  END LOOP; END $$;