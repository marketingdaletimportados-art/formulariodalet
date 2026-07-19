
GRANT INSERT ON public.withdrawal_authorizations TO anon;

CREATE POLICY "Public can create authorizations"
ON public.withdrawal_authorizations
FOR INSERT
TO anon
WITH CHECK (
  status = 'awaiting_pickup'
  AND terms_accepted = true
  AND EXISTS (
    SELECT 1 FROM public.sellers s
    WHERE s.id = seller_id AND s.active = true
  )
);
