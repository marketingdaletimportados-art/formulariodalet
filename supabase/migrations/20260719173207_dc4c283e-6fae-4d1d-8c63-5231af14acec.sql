
-- =========================================================================
-- 1) Roles infrastructure
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role: SECURITY DEFINER to avoid RLS recursion on policy checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_seller_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT seller_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'seller'
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_authorization_protocol() FROM PUBLIC, anon, authenticated;

-- user_roles policies
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =========================================================================
-- 2) withdrawal_authorizations — remove anon INSERT and require admin/seller
-- =========================================================================
DROP POLICY IF EXISTS "Public can create authorizations" ON public.withdrawal_authorizations;
DROP POLICY IF EXISTS "Authenticated can view all authorizations" ON public.withdrawal_authorizations;
DROP POLICY IF EXISTS "Authenticated can insert authorizations" ON public.withdrawal_authorizations;
DROP POLICY IF EXISTS "Authenticated can update authorizations" ON public.withdrawal_authorizations;

REVOKE INSERT, SELECT, UPDATE, DELETE ON public.withdrawal_authorizations FROM anon;

-- Admins: full access
CREATE POLICY "Admins can view authorizations" ON public.withdrawal_authorizations
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can update authorizations" ON public.withdrawal_authorizations
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sellers: view own + mark as picked_up
CREATE POLICY "Sellers can view own authorizations" ON public.withdrawal_authorizations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'seller')
    AND seller_id = public.current_seller_id()
  );

CREATE POLICY "Sellers can mark as picked up" ON public.withdrawal_authorizations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'seller')
    AND seller_id = public.current_seller_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'seller')
    AND seller_id = public.current_seller_id()
    AND status IN ('awaiting_pickup', 'picked_up')
  );

-- =========================================================================
-- 3) sellers — admin-only management; keep public read for active
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated can view all sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated can insert sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated can update sellers" ON public.sellers;
DROP POLICY IF EXISTS "Authenticated can delete sellers" ON public.sellers;

CREATE POLICY "Admins can view all sellers" ON public.sellers
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert sellers" ON public.sellers
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update sellers" ON public.sellers
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete sellers" ON public.sellers
  FOR DELETE TO authenticated USING (public.is_admin());

-- Sellers can view their own seller record
CREATE POLICY "Sellers can view own record" ON public.sellers
  FOR SELECT TO authenticated
  USING (id = public.current_seller_id());

-- "Public can view active sellers" policy is retained (needed for public form slug lookup).

-- =========================================================================
-- 4) system_settings — admin-only
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated can insert settings" ON public.system_settings;
DROP POLICY IF EXISTS "Authenticated can update settings" ON public.system_settings;

CREATE POLICY "Admins can view settings" ON public.system_settings
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins can insert settings" ON public.system_settings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update settings" ON public.system_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================================
-- 5) Storage: admin-only direct access to withdrawal-authorizations bucket
-- =========================================================================
DROP POLICY IF EXISTS "Admins can read withdrawal PDFs" ON storage.objects;
CREATE POLICY "Admins can read withdrawal PDFs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'withdrawal-authorizations' AND public.is_admin());

DROP POLICY IF EXISTS "Sellers can read own withdrawal PDFs" ON storage.objects;
CREATE POLICY "Sellers can read own withdrawal PDFs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'withdrawal-authorizations'
    AND public.has_role(auth.uid(), 'seller')
    AND EXISTS (
      SELECT 1 FROM public.withdrawal_authorizations wa
      WHERE wa.pdf_path = storage.objects.name
        AND wa.seller_id = public.current_seller_id()
    )
  );
