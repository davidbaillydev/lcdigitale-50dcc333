-- Le poste cuisine et l'écran livraison n'écrivent que les colonnes d'exploitation.
-- payment_status, payment_ref et les montants ne peuvent plus être touchés par un compte membre :
-- ils restent réservés aux fonctions serveur (service_role) qui relisent le prestataire de paiement.
REVOKE UPDATE ON public.orders FROM authenticated, anon;
GRANT UPDATE (status, slot, courier_status, courier_at, courier_name, driver_id, updated_at) ON public.orders TO authenticated;