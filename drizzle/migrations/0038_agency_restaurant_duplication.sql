CREATE OR REPLACE FUNCTION public.duplicate_agency_restaurant(_source uuid, _identity jsonb, _menu jsonb, _options jsonb, _copy_brand boolean, _copy_opening boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.restaurants%ROWTYPE; target uuid := gen_random_uuid();
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Réservé à un administrateur agence'; END IF;
 SELECT * INTO src FROM public.restaurants WHERE id = _source FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant source introuvable'; END IF;
 IF length(trim(coalesce(_identity->>'name',''))) NOT BETWEEN 1 AND 80 OR length(coalesce(_identity->>'slug','')) NOT BETWEEN 2 AND 40 OR (_identity->>'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR (_identity->>'slug') IN ('cuisine','connexion','agence','commande','suivi','api','admin','espace','reset-password','desabonnement','auth') THEN RAISE EXCEPTION 'Identité ou adresse web invalide'; END IF;
 IF coalesce(_identity->>'country','') NOT IN ('FR','SN','CI','CM','GA','CD','CG','BJ','BF','TG','ML','NE','TD','CF','GQ') OR coalesce(_identity->>'currency','') NOT IN ('EUR','XOF','XAF','CDF','USD') THEN RAISE EXCEPTION 'Pays ou devise invalide'; END IF;
 IF jsonb_typeof(_menu) IS DISTINCT FROM 'array' OR jsonb_typeof(_options) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Carte invalide'; END IF;
 INSERT INTO public.restaurants(id,name,slug,city,address,phone,email,menu_key,menu,brand,logo_url,opening,delivery,config,legal,enabled_features,active,sort_order)
 VALUES(target,trim(_identity->>'name'),_identity->>'slug',nullif(trim(_identity->>'city'),''),nullif(trim(_identity->>'address'),''),nullif(trim(_identity->>'phone'),''),nullif(trim(_identity->>'email'),''),'vierge',_menu,
 CASE WHEN _copy_brand THEN jsonb_strip_nulls(jsonb_build_object('primary',src.brand->'primary','accent',src.brand->'accent')) ELSE '{}'::jsonb END,
 CASE WHEN _copy_brand THEN src.logo_url ELSE NULL END,
 CASE WHEN _copy_opening THEN src.opening ELSE '{}'::jsonb END,
 '{"minOrder":0,"fee":0,"freeFrom":0,"zones":[]}'::jsonb,
 jsonb_build_object('country',_identity->>'country','currency',_identity->>'currency','ordersPaused',true,'slotMinutes',20,'lead',jsonb_build_object('pickup',20,'delivery',40),'modes',jsonb_build_object('pickup',true,'delivery',false,'dine_in',false),'payments',jsonb_build_object('online',false,'on_site',true,'counter',true,'card_terminal',false,'qr',false),'notifications',jsonb_build_object('recipients','[]'::jsonb,'team',false,'agency',false)),
 '{}'::jsonb,'{"pos":false}'::jsonb,false,(SELECT coalesce(max(sort_order),0)+1 FROM public.restaurants));
 INSERT INTO public.option_groups(id,restaurant_id,name,min_selection,max_selection,is_required,sort_order)
 SELECT x.id,target,x.name,x.min_selection,x.max_selection,x.is_required,x.sort_order FROM jsonb_to_recordset(coalesce(_options->'groups','[]')) AS x(id uuid,name text,min_selection integer,max_selection integer,is_required boolean,sort_order integer);
 INSERT INTO public.product_variants(id,restaurant_id,product_id,name,price,is_default,is_available,sort_order)
 SELECT x.id,target,x.product_id,x.name,x.price,x.is_default,x.is_available,x.sort_order FROM jsonb_to_recordset(coalesce(_options->'variants','[]')) AS x(id uuid,product_id text,name text,price numeric,is_default boolean,is_available boolean,sort_order integer);
 INSERT INTO public.option_items(id,restaurant_id,group_id,name,price,is_available,sort_order)
 SELECT x.id,target,x.group_id,x.name,x.price,x.is_available,x.sort_order FROM jsonb_to_recordset(coalesce(_options->'items','[]')) AS x(id uuid,group_id uuid,name text,price numeric,is_available boolean,sort_order integer);
 INSERT INTO public.product_option_groups(id,restaurant_id,product_id,group_id,variant_id)
 SELECT x.id,target,x.product_id,x.group_id,x.variant_id FROM jsonb_to_recordset(coalesce(_options->'links','[]')) AS x(id uuid,product_id text,group_id uuid,variant_id uuid);
 IF EXISTS (SELECT 1 FROM public.option_items i JOIN public.option_groups g ON g.id=i.group_id WHERE i.restaurant_id=target AND g.restaurant_id<>target) OR EXISTS (SELECT 1 FROM public.product_option_groups l JOIN public.option_groups g ON g.id=l.group_id LEFT JOIN public.product_variants v ON v.id=l.variant_id WHERE l.restaurant_id=target AND (g.restaurant_id<>target OR (l.variant_id IS NOT NULL AND v.restaurant_id<>target))) THEN RAISE EXCEPTION 'Référence à un autre restaurant interdite'; END IF;
 RETURN target;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_agency_restaurant(uuid,jsonb,jsonb,jsonb,boolean,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_agency_restaurant(uuid,jsonb,jsonb,jsonb,boolean,boolean) TO authenticated;
COMMENT ON FUNCTION public.duplicate_agency_restaurant(uuid,jsonb,jsonb,jsonb,boolean,boolean) IS 'Agency-only atomic detached duplication; explicit identity, menu/options, brand colors/logo and hours only; never operational history, memberships, legal identity or integration secrets. Starts inactive and paused.';