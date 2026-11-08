CREATE OR REPLACE FUNCTION public.read_restaurant_menu_options(_restaurant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT jsonb_build_object(
    'variants', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'product_id', v.product_id, 'name', v.name, 'price', v.price, 'is_default', v.is_default, 'is_available', v.is_available, 'sort_order', v.sort_order) ORDER BY v.sort_order, v.id) FROM public.product_variants v WHERE v.restaurant_id = _restaurant_id), '[]'::jsonb),
    'groups', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'min_selection', g.min_selection, 'max_selection', g.max_selection, 'is_required', g.is_required, 'sort_order', g.sort_order) ORDER BY g.sort_order, g.id) FROM public.option_groups g WHERE g.restaurant_id = _restaurant_id), '[]'::jsonb),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', i.id, 'group_id', i.group_id, 'name', i.name, 'price', i.price, 'is_available', i.is_available, 'sort_order', i.sort_order) ORDER BY i.sort_order, i.id) FROM public.option_items i WHERE i.restaurant_id = _restaurant_id), '[]'::jsonb),
    'links', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', l.id, 'product_id', l.product_id, 'group_id', l.group_id, 'variant_id', l.variant_id)) FROM public.product_option_groups l WHERE l.restaurant_id = _restaurant_id), '[]'::jsonb)
  );
$function$;
REVOKE ALL ON FUNCTION public.read_restaurant_menu_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_restaurant_menu_options(uuid) TO anon, authenticated, service_role;
COMMENT ON FUNCTION public.read_restaurant_menu_options(uuid) IS 'Public menu DTO for exactly one restaurant, including inactive restaurants for kiosks. No global listing, private columns, or writes.';
ALTER POLICY "Public read variants" ON public.product_variants TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));
ALTER POLICY "Public read option groups" ON public.option_groups TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));
ALTER POLICY "Public read option items" ON public.option_items TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));
ALTER POLICY "Public read product option groups" ON public.product_option_groups TO authenticated USING (public.can_access_restaurant(auth.uid(), restaurant_id));