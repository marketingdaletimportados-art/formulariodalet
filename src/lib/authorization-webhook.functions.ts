import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ authorizationId: z.string().uuid() });

const BUCKET = "withdrawal-authorizations";
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const WEBHOOK_TIMEOUT_MS = 20_000;

/**
 * Admin-only: resend an existing authorization's PDF to the n8n webhook.
 * Does NOT create a new authorization, protocol, or PDF file.
 */
export const resendAuthorizationWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !isAdmin) return { ok: false as const, error: "forbidden" };

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookUrl || !webhookSecret) {
      return { ok: false as const, error: "webhook_not_configured" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: rowError } = await supabaseAdmin
      .from("withdrawal_authorizations")
      .select(
        "id, protocol, submitted_at, buyer_name, buyer_phone, order_number, authorized_person_name, pdf_path, pdf_filename, pdf_generation_status, webhook_attempts, sellers(id, name, phone, department)",
      )
      .eq("id", data.authorizationId)
      .maybeSingle();

    if (rowError || !row) return { ok: false as const, error: "not_found" };
    if (row.pdf_generation_status !== "generated" || !row.pdf_path) {
      return { ok: false as const, error: "pdf_not_ready" };
    }
    const seller = row.sellers as unknown as
      | { id: string; name: string; phone: string; department: string | null }
      | null;
    if (!seller) return { ok: false as const, error: "seller_missing" };

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.pdf_path, SIGNED_URL_TTL_SECONDS);
    if (signedError || !signed?.signedUrl) {
      return { ok: false as const, error: "signed_url_failed" };
    }

    const payload = {
      event: "withdrawal_authorization.created",
      authorization_id: row.id,
      protocol: row.protocol,
      seller: {
        id: seller.id,
        name: seller.name,
        phone: seller.phone,
        department: seller.department,
      },
      buyer: { name: row.buyer_name, phone: row.buyer_phone },
      authorized_person: { name: row.authorized_person_name },
      order_number: row.order_number,
      pdf_signed_url: signed.signedUrl,
      pdf_filename: row.pdf_filename ?? `${row.protocol}.pdf`,
      created_at: row.submitted_at,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    let outcome: { ok: true } | { ok: false; error: string };
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": webhookSecret,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      outcome = response.status >= 200 && response.status < 300
        ? { ok: true }
        : { ok: false, error: `http_${response.status}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      outcome = { ok: false, error: message.includes("aborted") ? "timeout" : message.slice(0, 200) };
    } finally {
      clearTimeout(timeout);
    }

    const attempts = (row.webhook_attempts ?? 0) + 1;
    if (outcome.ok) {
      await supabaseAdmin
        .from("withdrawal_authorizations")
        .update({
          webhook_status: "sent",
          webhook_sent_at: new Date().toISOString(),
          webhook_error: null,
          webhook_attempts: attempts,
        })
        .eq("id", row.id);
      return { ok: true as const };
    }

    await supabaseAdmin
      .from("withdrawal_authorizations")
      .update({
        webhook_status: "failed",
        webhook_error: outcome.error.slice(0, 500),
        webhook_attempts: attempts,
      })
      .eq("id", row.id);
    return { ok: false as const, error: outcome.error };
  });
