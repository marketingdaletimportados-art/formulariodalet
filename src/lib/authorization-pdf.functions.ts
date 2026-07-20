import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idSchema = z.object({ authorizationId: z.string().uuid() });

const SIGNED_URL_TTL_SECONDS = 900; // 15 minutes
const BUCKET = "withdrawal-authorizations";

type AuthRow = {
  id: string;
  protocol: string;
  submitted_at: string;
  terms_accepted_at: string;
  buyer_name: string;
  buyer_cpf: string;
  buyer_phone: string;
  order_number: string;
  authorized_person_name: string;
  authorized_person_cpf: string;
  products_description: string;
  customer_notes: string | null;
  pdf_path: string | null;
  pdf_filename: string | null;
  pdf_generation_status: string;
  sellers: { id: string; name: string; department: string | null; phone: string } | null;
};

async function loadAuthorization(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("withdrawal_authorizations")
    .select(
      "id, protocol, submitted_at, terms_accepted_at, buyer_name, buyer_cpf, buyer_phone, order_number, authorized_person_name, authorized_person_cpf, products_description, customer_notes, pdf_path, pdf_filename, pdf_generation_status, sellers(id, name, department, phone)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("db_error");
  return (data as unknown as AuthRow) ?? null;
}

async function buildAndUploadPdf(row: AuthRow) {
  const { renderAuthorizationPdf } = await import("./pdf.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (!row.sellers) throw new Error("seller_missing");

  const bytes = await renderAuthorizationPdf({
    protocol: row.protocol,
    submittedAt: row.submitted_at,
    termsAcceptedAt: row.terms_accepted_at,
    seller: { name: row.sellers.name, department: row.sellers.department },
    buyer: {
      name: row.buyer_name,
      cpf: row.buyer_cpf,
      phone: row.buyer_phone,
      orderNumber: row.order_number,
    },
    authorized: { name: row.authorized_person_name, cpf: row.authorized_person_cpf },
    products: row.products_description,
    notes: row.customer_notes,
  });

  const year = row.protocol.split("-")[1] ?? new Date(row.submitted_at).getFullYear().toString();
  const filename = `${row.protocol}.pdf`;
  const path = `${year}/${filename}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error("upload_failed");

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("withdrawal_authorizations")
    .update({
      pdf_path: path,
      pdf_filename: filename,
      pdf_generated_at: nowIso,
      pdf_generation_status: "generated",
      pdf_generation_error: null,
    })
    .eq("id", row.id);
  if (updateError) throw new Error("db_update_failed");

  return { path, filename, generatedAt: nowIso };
}

async function createSignedUrl(path: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error("signed_url_failed");
  return data.signedUrl;
}

async function markFailed(id: string, message: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("withdrawal_authorizations")
      .update({
        pdf_generation_status: "failed",
        pdf_generation_error: message.slice(0, 500),
      })
      .eq("id", id);
  } catch {
    // ignore secondary failure
  }
}


/** Admin-only: fresh signed URL for an existing PDF. */
export const getAuthorizationPdfSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const row = await loadAuthorization(data.authorizationId);
    if (!row) return { ok: false as const, error: "not_found" };
    if (!row.pdf_path || row.pdf_generation_status !== "generated") {
      return { ok: false as const, error: "not_generated" };
    }
    try {
      const signedUrl = await createSignedUrl(row.pdf_path);
      return { ok: true as const, signedUrl, filename: row.pdf_filename ?? `${row.protocol}.pdf` };
    } catch {
      return { ok: false as const, error: "signed_url_failed" };
    }
  });

/** Admin-only: (re)generate the PDF from the stored data. */
export const regenerateAuthorizationPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => idSchema.parse(data))
  .handler(async ({ data }) => {
    const row = await loadAuthorization(data.authorizationId);
    if (!row) return { ok: false as const, error: "not_found" };
    try {
      const result = await buildAndUploadPdf(row);
      const signedUrl = await createSignedUrl(result.path);
      return { ok: true as const, signedUrl, filename: result.filename };
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      await markFailed(row.id, message);
      return { ok: false as const, error: "generation_failed" };
    }
  });
