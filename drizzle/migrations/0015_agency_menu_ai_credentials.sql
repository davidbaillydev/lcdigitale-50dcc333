CREATE TABLE public.agency_menu_ai_credentials (
  id text PRIMARY KEY CHECK (id = 'gemini'),
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.agency_menu_ai_credentials FROM anon, authenticated;
GRANT ALL ON public.agency_menu_ai_credentials TO service_role;
ALTER TABLE public.agency_menu_ai_credentials ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.agency_menu_ai_credentials IS 'Private agency Gemini credential for staged menu analysis. No browser policies; agency-checked server access only.';