-- Run with psql -X -v ON_ERROR_STOP=1 -f src/test/menu-options-access.rls.sql.
-- Fixtures and access claims are transaction-local; no production rows change.
BEGIN;
SELECT gen_random_uuid() AS active_id, gen_random_uuid() AS inactive_id,
       gen_random_uuid() AS member_id, gen_random_uuid() AS outsider_id \gset

INSERT INTO public.restaurants(id, slug, name, menu_key, active)
VALUES (:'active_id', 'test-' || replace(:'active_id', '-', ''), 'Menu access test active', 'vierge', true),
       (:'inactive_id', 'test-' || replace(:'inactive_id', '-', ''), 'Menu access test inactive', 'vierge', false);
INSERT INTO public.restaurant_members(restaurant_id, user_id, role)
VALUES (:'inactive_id', :'member_id', 'manager');
INSERT INTO public.option_groups(restaurant_id, name)
SELECT id, 'Access test group' FROM public.restaurants WHERE id IN (:'active_id', :'inactive_id');
INSERT INTO public.product_variants(restaurant_id, product_id, name, price)
SELECT id, 'access-test', 'Access test size', 1 FROM public.restaurants WHERE id IN (:'active_id', :'inactive_id');
INSERT INTO public.option_items(restaurant_id, group_id, name, price)
SELECT restaurant_id, id, 'Access test item', 1 FROM public.option_groups WHERE restaurant_id IN (:'active_id', :'inactive_id');
INSERT INTO public.product_option_groups(restaurant_id, product_id, group_id)
SELECT restaurant_id, 'access-test', id FROM public.option_groups WHERE restaurant_id IN (:'active_id', :'inactive_id');

CREATE FUNCTION pg_temp.assert_menu_access(restaurant uuid, expected integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE result jsonb; part jsonb; n integer;
BEGIN
  result := public.read_restaurant_menu_options(restaurant);
  IF result IS NULL OR (SELECT count(*) FROM jsonb_object_keys(result)) <> 4 THEN
    RAISE EXCEPTION 'Unexpected menu response';
  END IF;
  FOR part IN SELECT value FROM jsonb_each(result) LOOP
    IF jsonb_array_length(part) <> expected THEN RAISE EXCEPTION 'Menu visibility mismatch'; END IF;
  END LOOP;
  SELECT count(*) INTO n FROM public.product_variants WHERE restaurant_id = restaurant;
  IF n <> expected THEN RAISE EXCEPTION 'Variant visibility mismatch'; END IF;
  SELECT count(*) INTO n FROM public.option_groups WHERE restaurant_id = restaurant;
  IF n <> expected THEN RAISE EXCEPTION 'Group visibility mismatch'; END IF;
  SELECT count(*) INTO n FROM public.option_items WHERE restaurant_id = restaurant;
  IF n <> expected THEN RAISE EXCEPTION 'Item visibility mismatch'; END IF;
  SELECT count(*) INTO n FROM public.product_option_groups WHERE restaurant_id = restaurant;
  IF n <> expected THEN RAISE EXCEPTION 'Link visibility mismatch'; END IF;
END $$;

SET LOCAL ROLE anon;
SELECT pg_temp.assert_menu_access(:'active_id', 1);
SELECT pg_temp.assert_menu_access(:'inactive_id', 0);
SELECT pg_temp.assert_menu_access(NULL, 0);
SELECT pg_temp.assert_menu_access('00000000-0000-0000-0000-000000000000', 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'outsider_id', true) IS NOT NULL AS claims_set;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_menu_access(:'active_id', 1);
SELECT pg_temp.assert_menu_access(:'inactive_id', 0);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', :'member_id', true) IS NOT NULL AS claims_set;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_menu_access(:'active_id', 1);
SELECT pg_temp.assert_menu_access(:'inactive_id', 1);
RESET ROLE;
DO $$ DECLARE agency uuid; BEGIN
  SELECT user_id INTO agency FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF agency IS NULL THEN RAISE EXCEPTION 'An agency administrator is required for this check'; END IF;
  PERFORM set_config('request.jwt.claim.sub', agency::text, true);
END $$;
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_menu_access(:'active_id', 1);
SELECT pg_temp.assert_menu_access(:'inactive_id', 1);
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_menu_access(:'active_id', 1);
SELECT pg_temp.assert_menu_access(:'inactive_id', 1);
RESET ROLE;
ROLLBACK;
\echo 'Menu visibility checks passed; all fixtures rolled back.'