import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  sellerId: z.string().uuid(),
  withPdf: z.boolean(),
});

const BUCKET = "withdrawal-authorizations";
const TEST_PDF_PATH = "test/sample.pdf";
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const WEBHOOK_TIMEOUT_MS = 20_000;
const TEST_MESSAGE = "Teste de integração Dalet Importados";

async function ensureTestPdf() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin.storage
    .from(BUCKET)
    .list("test", { limit: 1, search: "sample.pdf" });
  if (existing && existing.some((f) => f.name === "sample.pdf")) return TEST_PDF_PATH;

  const { renderAuthorizationPdf } = await import("./pdf.server");
  const nowIso = new Date().toISOString();
  const bytes = await renderAuthorizationPdf({
    protocol: "AUT-TESTE-000000",
    submittedAt: nowIso,
    termsAcceptedAt: nowIso,
    seller: { name: "Vendedor de Teste", department: "Integração" },
    buyer: {
      name: "Comprador de Teste",
      cpf: "00000000000",
      phone: "0000000000",
      orderNumber: "TESTE-0001",
    },
    authorized: { name: "Pessoa Autorizada de Teste", cpf: "00000000000" },
    products: "Este é um documento PDF gerado apenas para testar a integração com o WhatsApp via n8n / Evolution API. Nenhuma autorização real foi criada.",
    notes: "Documento de teste — não possui validade.",
  });

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(TEST_PDF_PATH, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`test_pdf_upload_failed: ${error.message}`);
  return TEST_PDF_PATH;
}

/** Admin-only: send a test payload to the configured n8n webhook. */
export const sendWhatsappTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("is_admin");
    if (roleError || !isAdmin) return { ok: false as const, error: "forbidden" };

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookUrl || !webhookSecret) {
      return { ok: false as const, error: "webhook_not_configured" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: seller, error: sellerError } = await supabaseAdmin
      .from("sellers")
      .select("id, name, department, phone, active")
      .eq("id", data.sellerId)
      .maybeSingle();

    if (sellerError) return { ok: false as const, error: "db_error" };
    if (!seller) return { ok: false as const, error: "seller_not_found" };

    let signedUrl: string | null = null;
    let filename: string | null = null;
    if (data.withPdf) {
      try {
        const path = await ensureTestPdf();
        const { data: signed, error: signedError } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
        if (signedError || !signed?.signedUrl) throw new Error("signed_url_failed");
        signedUrl = signed.signedUrl;
        filename = "teste.pdf";
      } catch (err) {
        const message = err instanceof Error ? err.message : "unknown";
        return { ok: false as const, error: `pdf_error: ${message}` };
      }
    }

    const payload = {
      event: "test.whatsapp",
      test: true,
      seller: { id: seller.id, name: seller.name, phone: seller.phone },
      message: TEST_MESSAGE,
      pdf_signed_url: signedUrl,
      pdf_filename: filename,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    let httpStatus: number | null = null;
    let responseExcerpt: string | null = null;
    let success = false;
    let errorMessage: string | null = null;

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
      httpStatus = response.status;
      const text = await response.text().catch(() => "");
      responseExcerpt = text.slice(0, 500);
      success = response.status >= 200 && response.status < 300;
      if (!success) errorMessage = `http_${response.status}`;
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      errorMessage = message.includes("aborted") ? "timeout" : message.slice(0, 200);
    } finally {
      clearTimeout(timeout);
    }

    // Log to history
    await supabaseAdmin.from("webhook_test_logs").insert({
      seller_id: seller.id,
      seller_name: seller.name,
      seller_phone: seller.phone,
      with_pdf: data.withPdf,
      success,
      http_status: httpStatus,
      response_excerpt: responseExcerpt,
      error: errorMessage,
      triggered_by: context.userId,
    });

    // Prune to last 20
    const { data: extras } = await supabaseAdmin
      .from("webhook_test_logs")
      .select("id")
      .order("created_at", { ascending: false })
      .range(20, 999);
    if (extras && extras.length > 0) {
      await supabaseAdmin
        .from("webhook_test_logs")
        .delete()
        .in("id", extras.map((r) => r.id));
    }

    return {
      ok: success,
      httpStatus,
      responseExcerpt,
      error: errorMessage,
      sentAt: new Date().toISOString(),
    };
  });
