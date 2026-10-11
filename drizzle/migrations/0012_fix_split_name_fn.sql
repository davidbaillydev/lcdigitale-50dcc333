CREATE OR REPLACE FUNCTION public.fill_split_name()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE j jsonb := to_jsonb(NEW); full_name text;
BEGIN
  full_name := trim(coalesce(j->>'customer_name', j->>'name', ''));
  IF NEW.first_name IS NULL AND full_name <> '' THEN
    NEW.first_name := split_part(full_name, ' ', 1);
    NEW.last_name := coalesce(NEW.last_name, nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''));
  END IF;
  RETURN NEW;
END; $$;