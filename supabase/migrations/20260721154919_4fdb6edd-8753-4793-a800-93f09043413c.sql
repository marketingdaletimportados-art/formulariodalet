-- Normalize existing seller phones to international E.164 digits.
-- Brazilian numbers stored with 10 or 11 digits get 55 prefixed.
-- Numbers already starting with 55 (12-13 digits) or otherwise international are left as-is (digits only).
UPDATE public.sellers
SET phone = CASE
  WHEN length(regexp_replace(phone, '\D', '', 'g')) IN (10, 11)
       AND left(regexp_replace(phone, '\D', '', 'g'), 2) <> '55'
    THEN '55' || regexp_replace(phone, '\D', '', 'g')
  ELSE regexp_replace(phone, '\D', '', 'g')
END
WHERE phone IS NOT NULL
  AND phone <> regexp_replace(phone, '\D', '', 'g')
  OR (
    length(regexp_replace(phone, '\D', '', 'g')) IN (10, 11)
    AND left(regexp_replace(phone, '\D', '', 'g'), 2) <> '55'
  );