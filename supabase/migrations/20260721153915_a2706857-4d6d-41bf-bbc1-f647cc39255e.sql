CREATE TABLE public.webhook_test_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  seller_name TEXT NOT NULL,
  seller_phone TEXT NOT NULL,
  with_pdf BOOLEAN NOT NULL DEFAULT false,
  success BOOLEAN NOT NULL,
  http_status INT,
  response_excerpt TEXT,
  error TEXT,
  triggered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.webhook_test_logs TO authenticated;
GRANT ALL ON public.webhook_test_logs TO service_role;

ALTER TABLE public.webhook_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view test logs"
  ON public.webhook_test_logs FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can delete test logs"
  ON public.webhook_test_logs FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE INDEX idx_webhook_test_logs_created_at ON public.webhook_test_logs (created_at DESC);