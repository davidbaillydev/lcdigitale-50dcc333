CREATE TABLE public.restaurant_sms_campaigns (
 id uuid PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 name text NOT NULL,
 sender text NOT NULL,
 content text NOT NULL,
 customer_ids uuid[] NOT NULL,
 sent_phones text[] NOT NULL DEFAULT '{}',
 sent integer NOT NULL DEFAULT 0,
 skipped integer NOT NULL DEFAULT 0,
 state text NOT NULL DEFAULT 'idle' CHECK (state IN ('idle','sending','done','uncertain')),
 error text,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_sms_campaigns TO authenticated;
GRANT ALL ON public.restaurant_sms_campaigns TO service_role;
ALTER TABLE public.restaurant_sms_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency reads SMS campaigns" ON public.restaurant_sms_campaigns FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX restaurant_sms_campaigns_restaurant ON public.restaurant_sms_campaigns(restaurant_id, created_at DESC);
CREATE TABLE public.restaurant_sms_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.restaurant_sms_campaigns(id) ON DELETE CASCADE,
 customer_id uuid,
 phone text NOT NULL,
 state text NOT NULL DEFAULT 'sending' CHECK (state IN ('sending','submitted','skipped','failed','uncertain')),
 message_id text,
 error text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(campaign_id, phone)
);
GRANT SELECT ON public.restaurant_sms_deliveries TO authenticated;
GRANT ALL ON public.restaurant_sms_deliveries TO service_role;
ALTER TABLE public.restaurant_sms_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency reads SMS deliveries" ON public.restaurant_sms_deliveries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));