alter table public.restaurants add column if not exists logo_url text, add column if not exists brand jsonb not null default '{}'::jsonb;
create policy "Brand logos public read" on storage.objects for select using (bucket_id = 'brand');
create policy "Agency uploads logos" on storage.objects for insert to authenticated with check (bucket_id = 'brand' and public.has_role(auth.uid(), 'admin'));
create policy "Agency updates logos" on storage.objects for update to authenticated using (bucket_id = 'brand' and public.has_role(auth.uid(), 'admin'));