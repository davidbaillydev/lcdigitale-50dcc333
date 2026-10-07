CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_default boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_restaurant_idx ON public.product_variants(restaurant_id, product_id);

CREATE TABLE public.option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_selection integer NOT NULL DEFAULT 0 CHECK (min_selection >= 0),
  max_selection integer NOT NULL DEFAULT 5 CHECK (max_selection >= 1),
  is_required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX option_groups_restaurant_idx ON public.option_groups(restaurant_id);

CREATE TABLE public.option_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.option_groups(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX option_items_group_idx ON public.option_items(group_id);
CREATE INDEX option_items_restaurant_idx ON public.option_items(restaurant_id);

CREATE TABLE public.product_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  group_id uuid NOT NULL REFERENCES public.option_groups(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_option_groups_unique ON public.product_option_groups(product_id, group_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX product_option_groups_restaurant_idx ON public.product_option_groups(restaurant_id);

GRANT SELECT ON public.product_variants, public.option_groups, public.option_items, public.product_option_groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants, public.option_groups, public.option_items, public.product_option_groups TO authenticated;
GRANT ALL ON public.product_variants, public.option_groups, public.option_items, public.product_option_groups TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.option_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read variants" ON public.product_variants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read option groups" ON public.option_groups FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read option items" ON public.option_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read product option groups" ON public.product_option_groups FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Managers insert variants" ON public.product_variants FOR INSERT TO authenticated WITH CHECK (public.is_restaurant_manager(auth.uid(), restaurant_id));
CREATE POLICY "Managers delete variants" ON public.product_variants FOR DELETE TO authenticated USING (public.is_restaurant_manager(auth.uid(), restaurant_id));
CREATE POLICY "Staff update variants" ON public.product_variants FOR UPDATE TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.can_access_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers manage option groups" ON public.option_groups FOR ALL TO authenticated USING (public.is_restaurant_manager(auth.uid(), restaurant_id)) WITH CHECK (public.is_restaurant_manager(auth.uid(), restaurant_id));

CREATE POLICY "Managers insert option items" ON public.option_items FOR INSERT TO authenticated WITH CHECK (public.is_restaurant_manager(auth.uid(), restaurant_id) AND EXISTS (SELECT 1 FROM public.option_groups g WHERE g.id = group_id AND g.restaurant_id = option_items.restaurant_id));
CREATE POLICY "Managers delete option items" ON public.option_items FOR DELETE TO authenticated USING (public.is_restaurant_manager(auth.uid(), restaurant_id));
CREATE POLICY "Staff update option items" ON public.option_items FOR UPDATE TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id)) WITH CHECK (public.can_access_restaurant(auth.uid(), restaurant_id));

CREATE POLICY "Managers manage product option groups" ON public.product_option_groups FOR ALL TO authenticated USING (public.is_restaurant_manager(auth.uid(), restaurant_id)) WITH CHECK (public.is_restaurant_manager(auth.uid(), restaurant_id) AND EXISTS (SELECT 1 FROM public.option_groups g WHERE g.id = group_id AND g.restaurant_id = product_option_groups.restaurant_id));

-- Le personnel cuisine ne peut changer que la disponibilité ; le reste est réservé au gérant / à l'agence.
CREATE OR REPLACE FUNCTION public.guard_menu_option_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_restaurant_manager(auth.uid(), OLD.restaurant_id) THEN RETURN NEW; END IF;
  IF NEW.restaurant_id <> OLD.restaurant_id OR NEW.name <> OLD.name OR NEW.price <> OLD.price OR NEW.sort_order <> OLD.sort_order THEN
    RAISE EXCEPTION 'Seule la disponibilité peut être modifiée par l''équipe';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER option_items_guard BEFORE UPDATE ON public.option_items FOR EACH ROW EXECUTE FUNCTION public.guard_menu_option_update();
CREATE TRIGGER product_variants_guard BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.guard_menu_option_update();

ALTER PUBLICATION supabase_realtime ADD TABLE public.product_variants, public.option_groups, public.option_items, public.product_option_groups;