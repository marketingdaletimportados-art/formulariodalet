
CREATE TABLE public.system_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_enabled BOOLEAN NOT NULL DEFAULT false,
  webhook_url TEXT,
  webhook_secret TEXT,
  pdf_signed_url_expiration_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view settings" ON public.system_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert settings" ON public.system_settings
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update settings" ON public.system_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

INSERT INTO public.system_settings (webhook_enabled, webhook_url, webhook_secret, pdf_signed_url_expiration_minutes)
VALUES (false, '', '', 15);
