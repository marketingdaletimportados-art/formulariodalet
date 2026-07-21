ALTER TABLE public.withdrawal_authorizations
  ADD COLUMN IF NOT EXISTS webhook_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS webhook_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_error text,
  ADD COLUMN IF NOT EXISTS webhook_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE public.withdrawal_authorizations
  DROP CONSTRAINT IF EXISTS withdrawal_authorizations_webhook_status_check;

ALTER TABLE public.withdrawal_authorizations
  ADD CONSTRAINT withdrawal_authorizations_webhook_status_check
  CHECK (webhook_status IN ('pending', 'sent', 'failed'));