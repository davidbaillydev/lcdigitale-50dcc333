ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS first_name text, ADD COLUMN IF NOT EXISTS last_name text, ADD COLUMN IF NOT EXISTS received_email_at timestamptz, ADD COLUMN IF NOT EXISTS restaurant_email_at timestamptz;
ALTER TABLE public.restaurant_customers ADD COLUMN IF NOT EXISTS first_name text, ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE public.orders SET first_name = split_part(trim(customer_name), ' ', 1),
  last_name = nullif(trim(substr(trim(customer_name), length(split_part(trim(customer_name), ' ', 1)) + 1)), '')
  WHERE first_name IS NULL;
UPDATE public.restaurant_customers SET first_name = split_part(trim(name), ' ', 1),
  last_name = nullif(trim(substr(trim(name), length(split_part(trim(name), ' ', 1)) + 1)), '')
  WHERE first_name IS NULL AND name IS NOT NULL;
UPDATE public.restaurants r SET sort_order = s.rn FROM (SELECT id, row_number() OVER (ORDER BY name) AS rn FROM public.restaurants) s WHERE s.id = r.id;

CREATE OR REPLACE FUNCTION public.fill_split_name()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE full_name text;
BEGIN
  full_name := trim(coalesce(CASE WHEN TG_TABLE_NAME = 'orders' THEN NEW.customer_name ELSE NEW.name END, ''));
  IF NEW.first_name IS NULL AND full_name <> '' THEN
    NEW.first_name := split_part(full_name, ' ', 1);
    NEW.last_name := coalesce(NEW.last_name, nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''));
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER orders_fill_split_name BEFORE INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.fill_split_name();
CREATE TRIGGER customers_fill_split_name BEFORE INSERT OR UPDATE OF name ON public.restaurant_customers FOR EACH ROW EXECUTE FUNCTION public.fill_split_name();