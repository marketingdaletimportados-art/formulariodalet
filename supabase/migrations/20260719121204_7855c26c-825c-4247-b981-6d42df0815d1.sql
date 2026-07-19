ALTER TABLE public.withdrawal_authorizations
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_filename text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_generation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pdf_generation_error text;

ALTER TABLE public.withdrawal_authorizations
  DROP CONSTRAINT IF EXISTS withdrawal_authorizations_pdf_status_check;
ALTER TABLE public.withdrawal_authorizations
  ADD CONSTRAINT withdrawal_authorizations_pdf_status_check
  CHECK (pdf_generation_status IN ('pending','generated','failed'));

-- Storage policies for the private bucket 'withdrawal-authorizations'.
-- Only authenticated admins can read/list/modify objects directly; anonymous access
-- happens exclusively via short-lived signed URLs generated server-side.
DROP POLICY IF EXISTS "Authenticated can read withdrawal PDFs" ON storage.objects;
CREATE POLICY "Authenticated can read withdrawal PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'withdrawal-authorizations');

DROP POLICY IF EXISTS "Authenticated can insert withdrawal PDFs" ON storage.objects;
CREATE POLICY "Authenticated can insert withdrawal PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'withdrawal-authorizations');

DROP POLICY IF EXISTS "Authenticated can update withdrawal PDFs" ON storage.objects;
CREATE POLICY "Authenticated can update withdrawal PDFs"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'withdrawal-authorizations')
  WITH CHECK (bucket_id = 'withdrawal-authorizations');

DROP POLICY IF EXISTS "Authenticated can delete withdrawal PDFs" ON storage.objects;
CREATE POLICY "Authenticated can delete withdrawal PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'withdrawal-authorizations');