
-- Sectors table
CREATE TABLE IF NOT EXISTS public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sectors TO anon, authenticated;
GRANT ALL ON public.sectors TO service_role;

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sectors"
  ON public.sectors FOR SELECT
  USING (active = true OR public.is_admin());

CREATE POLICY "Admins manage sectors"
  ON public.sectors FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER set_sectors_updated_at
  BEFORE UPDATE ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

INSERT INTO public.sectors (name) VALUES
  ('Celulares'),
  ('Eletrônicos'),
  ('Acessórios para Celulares'),
  ('Casa e Lazer'),
  ('Perfumaria'),
  ('Cosméticos'),
  ('Marketing'),
  ('Administração'),
  ('Caixa'),
  ('Pacote'),
  ('Assistência Técnica'),
  ('Outros')
ON CONFLICT (name) DO NOTHING;

-- Sellers: registration_source + sector_id
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS registration_source TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sellers_phone_unique_idx ON public.sellers (phone);
