CREATE TABLE public.kiosk_pin_attempts (caller_key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_started_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.kiosk_pin_attempts TO service_role;
ALTER TABLE public.kiosk_pin_attempts ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.claim_kiosk_pin_attempt(_caller_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.kiosk_pin_attempts(caller_key, attempts, window_started_at) VALUES (_caller_key, 1, now())
 ON CONFLICT (caller_key) DO UPDATE SET attempts = CASE WHEN kiosk_pin_attempts.window_started_at <= now() - interval '5 minutes' THEN 1 ELSE kiosk_pin_attempts.attempts + 1 END, window_started_at = CASE WHEN kiosk_pin_attempts.window_started_at <= now() - interval '5 minutes' THEN now() ELSE kiosk_pin_attempts.window_started_at END
 RETURNING attempts INTO n;
 RETURN n <= 5;
END; $$;
REVOKE ALL ON FUNCTION public.claim_kiosk_pin_attempt(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_kiosk_pin_attempt(text) TO service_role;