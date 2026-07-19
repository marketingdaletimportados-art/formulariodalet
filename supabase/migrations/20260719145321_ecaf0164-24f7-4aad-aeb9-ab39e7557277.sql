
-- Grants for Data API (were missing, causing 401/permission denied)
GRANT SELECT ON public.sellers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sellers TO authenticated;
GRANT ALL ON public.sellers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.withdrawal_authorizations TO authenticated;
GRANT ALL ON public.withdrawal_authorizations TO service_role;

GRANT SELECT, UPDATE ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

GRANT ALL ON public.authorization_protocol_counters TO service_role;

-- Remove the permissive anon INSERT policy — the public form now goes
-- through a server function that uses the service-role client after
-- validating the seller and normalizing the payload.
DROP POLICY IF EXISTS "Public can create authorizations for active sellers" ON public.withdrawal_authorizations;
