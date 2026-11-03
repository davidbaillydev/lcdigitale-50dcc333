CREATE TABLE public.kiosk_licenses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
 kiosk_id text NOT NULL CHECK (kiosk_id ~ '^[A-Za-z0-9_-]{1,40}$'),
 label text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','ended')),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 notes text NOT NULL DEFAULT '',
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL,
 UNIQUE (restaurant_id, kiosk_id),
 CHECK (ends_on > starts_on)
);
GRANT SELECT, INSERT, UPDATE ON public.kiosk_licenses TO authenticated;
GRANT ALL ON public.kiosk_licenses TO service_role;
ALTER TABLE public.kiosk_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_kiosk_licenses ON public.kiosk_licenses FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE public.kiosk_license_billing (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 license_id uuid NOT NULL REFERENCES public.kiosk_licenses(id),
 starts_on date NOT NULL,
 ends_on date NOT NULL,
 amount_ht_cents integer NOT NULL DEFAULT 40000 CHECK (amount_ht_cents = 40000),
 status text NOT NULL DEFAULT 'to_invoice' CHECK (status IN ('to_invoice','invoiced','paid','cancelled')),
 invoice_reference text NOT NULL DEFAULT '',
 due_on date,
 paid_on date,
 notes text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL,
 UNIQUE (license_id, starts_on, ends_on),
 CHECK (ends_on > starts_on),
 CHECK (status <> 'paid' OR paid_on IS NOT NULL)
);
GRANT SELECT, INSERT, UPDATE ON public.kiosk_license_billing TO authenticated;
GRANT ALL ON public.kiosk_license_billing TO service_role;
ALTER TABLE public.kiosk_license_billing ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_kiosk_billing ON public.kiosk_license_billing FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX kiosk_licenses_restaurant ON public.kiosk_licenses(restaurant_id);
COMMENT ON TABLE public.kiosk_licenses IS 'Agency-managed software licensing registry only; does not gate kiosk operations.';
COMMENT ON TABLE public.kiosk_license_billing IS 'Manual external invoice tracking, not fiscal invoice issuance or provider-confirmed settlement.';