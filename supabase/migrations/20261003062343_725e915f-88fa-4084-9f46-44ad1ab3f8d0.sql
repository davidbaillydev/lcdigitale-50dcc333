CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name text NOT NULL,
  city text,
  address text,
  phone text,
  email text,
  menu_key text NOT NULL,
  opening jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active restaurants are public" ON public.restaurants FOR SELECT TO anon, authenticated USING (active OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.restaurant_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('manager','kitchen')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id, role)
);
GRANT SELECT ON public.restaurant_members TO authenticated;
GRANT ALL ON public.restaurant_members TO service_role;
ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_role(_user_id, 'admin') or exists (
    select 1 from public.restaurant_members where user_id = _user_id and restaurant_id = _restaurant_id)
$$;
CREATE OR REPLACE FUNCTION public.is_restaurant_manager(_user_id uuid, _restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select public.has_role(_user_id, 'admin') or exists (
    select 1 from public.restaurant_members where user_id = _user_id and restaurant_id = _restaurant_id and role = 'manager')
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_restaurant(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_restaurant_manager(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_access_restaurant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_restaurant_manager(uuid, uuid) TO authenticated;

CREATE POLICY "Members see own memberships" ON public.restaurant_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_restaurant_manager(auth.uid(), restaurant_id));

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.restaurants (slug, name, city, phone, menu_key, opening, delivery, config) VALUES (
  'woknsushi', 'Wok & Sushi', 'Colomiers', '05 00 00 00 00', 'woknsushi',
  '{"0":[[1080,1350]],"1":[[690,870],[1080,1350]],"2":[[690,870],[1080,1350]],"3":[[690,870],[1080,1350]],"4":[[690,870],[1080,1350]],"5":[[690,870],[1080,1380]],"6":[[690,870],[1080,1380]]}'::jsonb,
  '{"minOrder":20,"fee":2.5,"freeFrom":40,"zones":[{"cp":"31770","city":"Colomiers"},{"cp":"31820","city":"Pibrac"},{"cp":"31700","city":"Cornebarrieu / Blagnac"},{"cp":"31170","city":"Tournefeuille"},{"cp":"31490","city":"Léguevin / Brax"},{"cp":"31300","city":"Toulouse Purpan / Saint-Martin"}]}'::jsonb,
  '{"slotMinutes":20,"lead":{"pickup":20,"delivery":40},"hoursLabel":"11h30–14h30 · 18h–22h30","tagline":"Woks & sushis faits minute"}'::jsonb
);

ALTER TABLE public.orders ADD COLUMN restaurant_id uuid REFERENCES public.restaurants(id);
UPDATE public.orders SET restaurant_id = (SELECT id FROM public.restaurants WHERE slug = 'woknsushi');
ALTER TABLE public.orders ALTER COLUMN restaurant_id SET NOT NULL;
CREATE INDEX orders_restaurant_created_idx ON public.orders (restaurant_id, created_at);

INSERT INTO public.restaurant_members (restaurant_id, user_id, role)
SELECT r.id, ur.user_id, 'kitchen' FROM public.user_roles ur CROSS JOIN public.restaurants r
WHERE ur.role = 'staff' AND r.slug = 'woknsushi' ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Staff read orders" ON public.orders;
DROP POLICY IF EXISTS "Staff update orders" ON public.orders;
CREATE POLICY "Restaurant staff read orders" ON public.orders FOR SELECT TO authenticated
  USING (public.can_access_restaurant(auth.uid(), restaurant_id));
CREATE POLICY "Restaurant staff update orders" ON public.orders FOR UPDATE TO authenticated
  USING (public.can_access_restaurant(auth.uid(), restaurant_id))
  WITH CHECK (public.can_access_restaurant(auth.uid(), restaurant_id));