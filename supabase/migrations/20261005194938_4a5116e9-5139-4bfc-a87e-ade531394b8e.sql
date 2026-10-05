create table public.menu_stock (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id text not null,
  sold_out boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (restaurant_id, item_id)
);
grant select on public.menu_stock to anon;
grant select, insert, update, delete on public.menu_stock to authenticated;
grant all on public.menu_stock to service_role;
alter table public.menu_stock enable row level security;
create policy "Stock visible for active restaurants" on public.menu_stock for select to anon, authenticated
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.active));
create policy "Staff manage stock" on public.menu_stock for all to authenticated
  using (public.can_access_restaurant(auth.uid(), restaurant_id))
  with check (public.can_access_restaurant(auth.uid(), restaurant_id));
create trigger menu_stock_updated_at before update on public.menu_stock for each row execute function public.update_updated_at_column();
alter publication supabase_realtime add table public.menu_stock;

alter table public.orders add column room_label text, add column qr_mode text;