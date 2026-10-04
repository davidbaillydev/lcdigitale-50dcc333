ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS vapi_assistant_id text,
  ADD COLUMN IF NOT EXISTS vapi_public_key text,
  ADD COLUMN IF NOT EXISTS vapi_phone_number text,
  ADD COLUMN IF NOT EXISTS is_vapi_web_enabled boolean NOT NULL DEFAULT false;