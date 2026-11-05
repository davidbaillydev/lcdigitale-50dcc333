CREATE TABLE public.restaurant_campaign_waves (
 id uuid PRIMARY KEY,
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
 payload jsonb NOT NULL,
 remaining_ids uuid[] NOT NULL DEFAULT '{}',
 sent_emails text[] NOT NULL DEFAULT '{}',
 sent integer NOT NULL DEFAULT 0,
 state text NOT NULL DEFAULT 'idle' CHECK (state IN ('idle', 'sending', 'done', 'uncertain')),
 error text,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurant_campaign_waves TO authenticated;
GRANT ALL ON public.restaurant_campaign_waves TO service_role;
ALTER TABLE public.restaurant_campaign_waves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agency reads email waves" ON public.restaurant_campaign_waves FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX restaurant_campaign_waves_restaurant ON public.restaurant_campaign_waves(restaurant_id, created_at DESC);