
DROP POLICY IF EXISTS "Anyone can view active sectors" ON public.sectors;

CREATE POLICY "Public can view active sectors"
  ON public.sectors FOR SELECT
  TO anon, authenticated
  USING (active = true);

CREATE POLICY "Admins view all sectors"
  ON public.sectors FOR SELECT
  TO authenticated
  USING (public.is_admin());
