create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or _user_id = auth.uid() or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
     and exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or _user_id = auth.uid() or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
     and exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','staff'))
$$;
create or replace function public.is_restaurant_manager(_user_id uuid, _restaurant_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or _user_id = auth.uid() or exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'admin'))
     and (exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin')
          or exists (select 1 from public.restaurant_members where user_id = _user_id and restaurant_id = _restaurant_id and role = 'manager'))
$$;