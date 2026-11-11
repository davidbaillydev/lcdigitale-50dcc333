create or replace function public.lock_reservation_fee()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.no_show_fee is distinct from old.no_show_fee
     or new.stripe_customer is distinct from old.stripe_customer
     or new.payment_method is distinct from old.payment_method then
    if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres','service_role','supabase_admin') then
      raise exception 'Le montant et la carte de garantie ne peuvent pas être modifiés';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists lock_reservation_fee on public.reservations;
create trigger lock_reservation_fee before update on public.reservations
for each row execute function public.lock_reservation_fee();