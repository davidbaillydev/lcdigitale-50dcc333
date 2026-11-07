ALTER TABLE public.restaurant_members ADD COLUMN notification_roles text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.restaurant_members ADD CONSTRAINT restaurant_members_notification_roles_check CHECK (notification_roles <@ ARRAY['responsable','livreur','caissier']::text[]);
CREATE TABLE public.order_notification_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES public.orders(id),
 recipient_email text NOT NULL,
 state text NOT NULL DEFAULT 'sending' CHECK (state IN ('sending','sent','failed','uncertain')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id, recipient_email)
);
GRANT ALL ON public.order_notification_deliveries TO service_role;
ALTER TABLE public.order_notification_deliveries ENABLE ROW LEVEL SECURITY;