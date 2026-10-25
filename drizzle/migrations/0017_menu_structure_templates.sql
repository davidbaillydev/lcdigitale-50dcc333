CREATE TABLE public.menu_structure_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE UNIQUE,
 name text NOT NULL,
 structure jsonb NOT NULL DEFAULT '[]'::jsonb,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_structure_templates TO authenticated;
GRANT ALL ON public.menu_structure_templates TO service_role;
ALTER TABLE public.menu_structure_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY agency_read_menu_templates ON public.menu_structure_templates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));