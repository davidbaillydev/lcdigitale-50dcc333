ALTER FUNCTION public.read_restaurant_menu_options(uuid) SECURITY INVOKER;
ALTER FUNCTION public.read_restaurant_menu_options(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION public.read_restaurant_menu_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_restaurant_menu_options(uuid) TO anon, authenticated, service_role;

GRANT SELECT ON public.product_variants, public.option_groups, public.option_items, public.product_option_groups TO anon, authenticated;
CREATE POLICY "Active restaurant variants are public" ON public.product_variants FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = product_variants.restaurant_id AND r.active));
CREATE POLICY "Active restaurant option groups are public" ON public.option_groups FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = option_groups.restaurant_id AND r.active));
CREATE POLICY "Active restaurant option items are public" ON public.option_items FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = option_items.restaurant_id AND r.active));
CREATE POLICY "Active restaurant option links are public" ON public.product_option_groups FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = product_option_groups.restaurant_id AND r.active));
COMMENT ON FUNCTION public.read_restaurant_menu_options(uuid) IS 'Single-restaurant menu DTO executed as the caller under RLS. Public access only to active restaurants; inactive options require existing restaurant staff or agency access. No writes or private columns.';