DROP POLICY "Active restaurants are public" ON public.restaurants;
CREATE POLICY "Active restaurants are public" ON public.restaurants FOR SELECT TO anon USING (active);
CREATE POLICY "Signed-in see active or agency sees all" ON public.restaurants FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));