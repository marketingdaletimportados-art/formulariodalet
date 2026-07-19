-- SELLERS
CREATE TABLE public.sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  department TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sellers_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

GRANT SELECT ON public.sellers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;

ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active sellers"
  ON public.sellers FOR SELECT
  TO anon
  USING (active = true);

CREATE POLICY "Authenticated can view all sellers"
  ON public.sellers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert sellers"
  ON public.sellers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update sellers"
  ON public.sellers FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete sellers"
  ON public.sellers FOR DELETE
  TO authenticated
  USING (true);

-- PROTOCOL COUNTERS
CREATE TABLE public.authorization_protocol_counters (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

GRANT ALL ON public.authorization_protocol_counters TO service_role;
ALTER TABLE public.authorization_protocol_counters ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role and SECURITY DEFINER function can access.

-- PROTOCOL FUNCTION
CREATE OR REPLACE FUNCTION public.generate_authorization_protocol()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM now())::INT;
  n INT;
BEGIN
  INSERT INTO public.authorization_protocol_counters AS c (year, last_number)
  VALUES (y, 1)
  ON CONFLICT (year) DO UPDATE
    SET last_number = c.last_number + 1
  RETURNING c.last_number INTO n;
  RETURN 'AUT-' || y::TEXT || '-' || lpad(n::TEXT, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_authorization_protocol() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_authorization_protocol() TO anon, authenticated, service_role;

-- WITHDRAWAL AUTHORIZATIONS
CREATE TABLE public.withdrawal_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol TEXT NOT NULL UNIQUE DEFAULT public.generate_authorization_protocol(),
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE RESTRICT,
  buyer_name TEXT NOT NULL,
  buyer_cpf TEXT NOT NULL,
  buyer_phone TEXT NOT NULL,
  order_number TEXT NOT NULL,
  authorized_person_name TEXT NOT NULL,
  authorized_person_cpf TEXT NOT NULL,
  products_description TEXT NOT NULL,
  customer_notes TEXT,
  terms_accepted BOOLEAN NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_pickup',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT withdrawal_status_check CHECK (status IN ('awaiting_pickup','picked_up','cancelled')),
  CONSTRAINT withdrawal_terms_accepted_true CHECK (terms_accepted = true)
);

CREATE INDEX withdrawal_authorizations_seller_id_idx ON public.withdrawal_authorizations(seller_id);
CREATE INDEX withdrawal_authorizations_submitted_at_idx ON public.withdrawal_authorizations(submitted_at DESC);
CREATE INDEX withdrawal_authorizations_status_idx ON public.withdrawal_authorizations(status);

GRANT INSERT ON public.withdrawal_authorizations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_authorizations TO authenticated;
GRANT ALL ON public.withdrawal_authorizations TO service_role;

ALTER TABLE public.withdrawal_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can create authorizations for active sellers"
  ON public.withdrawal_authorizations FOR INSERT
  TO anon
  WITH CHECK (
    status = 'awaiting_pickup'
    AND picked_up_at IS NULL
    AND cancelled_at IS NULL
    AND terms_accepted = true
    AND EXISTS (
      SELECT 1 FROM public.sellers s
      WHERE s.id = seller_id AND s.active = true
    )
  );

CREATE POLICY "Authenticated can view all authorizations"
  ON public.withdrawal_authorizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update authorizations"
  ON public.withdrawal_authorizations FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can insert authorizations"
  ON public.withdrawal_authorizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER sellers_set_updated_at
  BEFORE UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

CREATE TRIGGER withdrawal_authorizations_set_updated_at
  BEFORE UPDATE ON public.withdrawal_authorizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();