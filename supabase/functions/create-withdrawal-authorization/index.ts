// Supabase Edge Function: create-withdrawal-authorization
// Public endpoint used by the customer-facing form. Validates input,
// looks up the seller by slug (server-side), creates the authorization,
// generates the PDF and uploads it to the private bucket.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

const BUCKET = "withdrawal-authorizations";
const SIGNED_URL_TTL_SECONDS = 15 * 60;
const WEBHOOK_TIMEOUT_MS = 20_000;

type WebhookOutcome =
  | { ok: true }
  | { ok: false; error: string };

async function sendN8nWebhook(payload: Record<string, unknown>): Promise<WebhookOutcome> {
  const webhookUrl = Deno.env.get("N8N_WEBHOOK_URL");
  const webhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");
  if (!webhookUrl || !webhookSecret) {
    return { ok: false, error: "webhook_not_configured" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
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
    if (response.status >= 200 && response.status < 300) return { ok: true };
    return { ok: false, error: `http_${response.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return { ok: false, error: message.includes("aborted") ? "timeout" : message.slice(0, 200) };
  } finally {
    clearTimeout(timeout);
  }
}

// ------------------------------ helpers ------------------------------

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function digits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function isValidCPF(raw: string) {
  const cpf = digits(raw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}

function trimStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function maskCpfDoc(cpf: string) {
  const d = digits(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatDateTimeBR(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// ------------------------------ PDF ------------------------------

const NAVY = rgb(0.06, 0.24, 0.55);
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.42, 0.47, 0.55);
const LIGHT = rgb(0.87, 0.9, 0.95);
const PANEL = rgb(0.96, 0.97, 0.99);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 60;

function sanitize(text: string) {
  // Strip characters outside WinAnsi that would break standard fonts.
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

// deno-lint-ignore no-explicit-any
function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = sanitize(text).split(/\r?\n/);
  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") { lines.push(""); continue; }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            const c2 = chunk + ch;
            if (font.widthOfTextAtSize(c2, size) > maxWidth) {
              lines.push(chunk); chunk = ch;
            } else { chunk = c2; }
          }
          line = chunk;
        } else { line = word; }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

type PdfData = {
  protocol: string;
  submittedAt: string;
  termsAcceptedAt: string;
  seller: { name: string; department: string | null };
  buyer: { name: string; cpf: string; phone: string; orderNumber: string };
  authorized: { name: string; cpf: string };
  products: string;
  notes: string | null;
};

async function renderPdf(data: PdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Autorização ${data.protocol}`);
  doc.setAuthor("Dalet Importados");
  doc.setSubject("Autorização para retirada de mercadoria");
  doc.setCreator("Dalet Importados");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN_TOP;

  const drawFooter = () => {
    page.drawText(
      "Documento gerado eletronicamente pelo sistema de autorização de retirada da Dalet Importados.",
      { x: MARGIN_X, y: 30, size: 8, font, color: MUTED },
    );
    const proto = data.protocol;
    page.drawText(proto, {
      x: PAGE_W - MARGIN_X - bold.widthOfTextAtSize(proto, 8),
      y: 30, size: 8, font: bold, color: MUTED,
    });
    page.drawLine({
      start: { x: MARGIN_X, y: 46 },
      end: { x: PAGE_W - MARGIN_X, y: 46 },
      thickness: 0.5, color: LIGHT,
    });
  };

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN_TOP;
    drawFooter();
  };

  const ensure = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) newPage();
  };

  const heading = (title: string) => {
    ensure(30); y -= 6;
    page.drawRectangle({ x: MARGIN_X, y: y - 4, width: 3, height: 14, color: NAVY });
    page.drawText(title, { x: MARGIN_X + 10, y, size: 11, font: bold, color: NAVY });
    y -= 8;
    page.drawLine({
      start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y },
      thickness: 0.5, color: LIGHT,
    });
    y -= 14;
  };

  const kvGrid = (rows: Array<[string, string]>) => {
    const colW = (PAGE_W - MARGIN_X * 2) / 2;
    for (let i = 0; i < rows.length; i += 2) {
      ensure(30);
      const pair = [rows[i], rows[i + 1]].filter(Boolean) as Array<[string, string]>;
      pair.forEach(([label, value], idx) => {
        const x = MARGIN_X + idx * colW;
        page.drawText(sanitize(label.toUpperCase()), {
          x, y, size: 7.5, font: bold, color: MUTED,
        });
        page.drawText(sanitize(value), {
          x, y: y - 13, size: 11, font, color: INK,
        });
      });
      y -= 30;
    }
  };

  // deno-lint-ignore no-explicit-any
  const paragraph = (text: string, opts?: { size?: number; color?: any; bold?: boolean; leading?: number }) => {
    const size = opts?.size ?? 10.5;
    const color = opts?.color ?? INK;
    const f = opts?.bold ? bold : font;
    const leading = opts?.leading ?? size * 1.45;
    const maxW = PAGE_W - MARGIN_X * 2;
    const lines = wrapText(text, f, size, maxW);
    for (const line of lines) {
      ensure(leading);
      if (line) page.drawText(line, { x: MARGIN_X, y, size, font: f, color });
      y -= leading;
    }
  };

  const panel = (text: string) => {
    const size = 10.5, leading = size * 1.5, padding = 12;
    const maxW = PAGE_W - MARGIN_X * 2 - padding * 2;
    const lines = wrapText(text, font, size, maxW);
    const height = lines.length * leading + padding * 2;
    ensure(height + 6);
    const top = y;
    page.drawRectangle({
      x: MARGIN_X, y: top - height, width: PAGE_W - MARGIN_X * 2, height,
      color: PANEL, borderColor: LIGHT, borderWidth: 0.5,
    });
    let ly = top - padding - size;
    for (const line of lines) {
      if (line) page.drawText(line, { x: MARGIN_X + padding, y: ly, size, font, color: INK });
      ly -= leading;
    }
    y = top - height - 6;
  };

  drawFooter();

  // Header
  page.drawRectangle({
    x: MARGIN_X, y: PAGE_H - MARGIN_TOP - 34, width: 40, height: 40, color: NAVY,
  });
  page.drawText("D", {
    x: MARGIN_X + 13, y: PAGE_H - MARGIN_TOP - 26,
    size: 24, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText("Dalet", {
    x: MARGIN_X + 50, y: PAGE_H - MARGIN_TOP - 8, size: 14, font: bold, color: NAVY,
  });
  page.drawText("Importados", {
    x: MARGIN_X + 50, y: PAGE_H - MARGIN_TOP - 22, size: 9, font, color: MUTED,
  });

  const rightX = PAGE_W - MARGIN_X;
  const protoLine = `Protocolo: ${data.protocol}`;
  const emittedLine = `Emitido em: ${formatDateTimeBR(data.submittedAt)}`;
  page.drawText(protoLine, {
    x: rightX - bold.widthOfTextAtSize(protoLine, 10),
    y: PAGE_H - MARGIN_TOP - 8, size: 10, font: bold, color: INK,
  });
  page.drawText(emittedLine, {
    x: rightX - font.widthOfTextAtSize(emittedLine, 9),
    y: PAGE_H - MARGIN_TOP - 22, size: 9, font, color: MUTED,
  });

  y = PAGE_H - MARGIN_TOP - 60;
  page.drawLine({
    start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y },
    thickness: 1, color: NAVY,
  });
  y -= 20;
  const title = "AUTORIZACAO PARA RETIRADA DE MERCADORIA";
  page.drawText(title, {
    x: (PAGE_W - bold.widthOfTextAtSize(title, 15)) / 2,
    y, size: 15, font: bold, color: NAVY,
  });
  y -= 22;

  heading("VENDEDOR RESPONSAVEL");
  const sellerRows: Array<[string, string]> = [["Nome", data.seller.name]];
  if (data.seller.department) sellerRows.push(["Setor", data.seller.department]);
  kvGrid(sellerRows);

  heading("DADOS DO COMPRADOR");
  kvGrid([
    ["Nome completo", data.buyer.name],
    ["CPF", maskCpfDoc(data.buyer.cpf)],
    ["Telefone (WhatsApp)", data.buyer.phone],
    ["Numero do pedido", data.buyer.orderNumber],
  ]);

  heading("PESSOA AUTORIZADA PARA RETIRADA");
  kvGrid([
    ["Nome completo", data.authorized.name],
    ["CPF", maskCpfDoc(data.authorized.cpf)],
  ]);

  heading("PRODUTOS AUTORIZADOS PARA RETIRADA");
  panel(data.products);

  if (data.notes && data.notes.trim()) {
    heading("OBSERVACOES");
    panel(data.notes);
  }

  heading("TERMO DE AUTORIZACAO");
  const termo = `Eu, ${data.buyer.name}, inscrito(a) no CPF nº ${maskCpfDoc(data.buyer.cpf)}, autorizo ${data.authorized.name}, inscrito(a) no CPF nº ${maskCpfDoc(data.authorized.cpf)}, a retirar em meu nome os produtos descritos neste documento, referentes ao pedido nº ${data.buyer.orderNumber}, adquirido na Dalet Importados.

Declaro que todas as informações prestadas são verdadeiras e assumo total responsabilidade por esta autorização.

Estou ciente de que a pessoa autorizada deverá apresentar documento oficial com foto no momento da retirada, para conferência das informações.`;
  paragraph(termo, { size: 10.5, leading: 15 });

  y -= 6;
  heading("REGISTRO DE ACEITE");
  paragraph("Termo aceito eletronicamente pelo comprador.", { bold: true });
  paragraph(`Data e hora do aceite: ${formatDateTimeBR(data.termsAcceptedAt)}`, { color: MUTED, size: 9.5 });
  paragraph(`Protocolo: ${data.protocol}`, { color: MUTED, size: 9.5 });

  return await doc.save();
}

// ------------------------------ handler ------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ success: false, message: "Método não permitido." }, 405);
  }

  console.log("[create-withdrawal-authorization] started");

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Configuração interna do Supabase indisponível.");
    return jsonResponse(
      { success: false, message: "Configuração interna indisponível." },
      500,
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ success: false, message: "Payload inválido." }, 400);
  }

  // Whitelist / normalize
  const input = {
    seller_slug: trimStr(payload.seller_slug, 80).toLowerCase(),
    buyer_name: trimStr(payload.buyer_name, 120),
    buyer_cpf: digits(String(payload.buyer_cpf ?? "")),
    buyer_phone: digits(String(payload.buyer_phone ?? "")),
    order_number: trimStr(payload.order_number, 30),
    authorized_person_name: trimStr(payload.authorized_person_name, 120),
    authorized_person_cpf: digits(String(payload.authorized_person_cpf ?? "")),
    products_description: trimStr(payload.products_description, 1000),
    customer_notes: payload.customer_notes == null
      ? null
      : trimStr(payload.customer_notes, 500) || null,
    terms_accepted: payload.terms_accepted === true,
  };

  // Validation
  const errors: string[] = [];
  if (!input.seller_slug) errors.push("Vendedor não informado.");
  if (input.buyer_name.length < 3) errors.push("Nome do comprador inválido.");
  if (!isValidCPF(input.buyer_cpf)) errors.push("CPF do comprador inválido.");
  if (input.buyer_phone.length < 10 || input.buyer_phone.length > 11)
    errors.push("Telefone do comprador inválido.");
  if (!input.order_number) errors.push("Número do pedido é obrigatório.");
  if (input.authorized_person_name.length < 3)
    errors.push("Nome da pessoa autorizada inválido.");
  if (!isValidCPF(input.authorized_person_cpf))
    errors.push("CPF da pessoa autorizada inválido.");
  if (input.products_description.length < 3)
    errors.push("Descreva os produtos autorizados.");
  if (!input.terms_accepted)
    errors.push("É necessário aceitar o termo de autorização.");

  if (errors.length > 0) {
    return jsonResponse(
      { success: false, message: errors.join(" ") },
      400,
    );
  }

  // Look up seller
  const { data: seller, error: sellerError } = await admin
    .from("sellers")
    .select("id, name, department, active, phone")
    .eq("slug", input.seller_slug)
    .maybeSingle();

  if (sellerError) {
    console.error("Erro ao buscar vendedor:", sellerError.message);
    return jsonResponse(
      { success: false, message: "Erro interno ao localizar o vendedor." },
      500,
    );
  }

  if (!seller || !seller.active) {
    return jsonResponse(
      { success: false, message: "Vendedor não encontrado ou indisponível." },
      404,
    );
  }
  console.log("[create-withdrawal-authorization] seller_found", seller.id);

  const nowIso = new Date().toISOString();

  // Insert authorization (protocol is generated by the DB default).
  const { data: created, error: insertError } = await admin
    .from("withdrawal_authorizations")
    .insert({
      seller_id: seller.id,
      buyer_name: input.buyer_name,
      buyer_cpf: input.buyer_cpf,
      buyer_phone: input.buyer_phone,
      order_number: input.order_number,
      authorized_person_name: input.authorized_person_name,
      authorized_person_cpf: input.authorized_person_cpf,
      products_description: input.products_description,
      customer_notes: input.customer_notes,
      terms_accepted: true,
      terms_accepted_at: nowIso,
      status: "awaiting_pickup",
      pdf_generation_status: "pending",
    })
    .select("id, protocol, submitted_at, terms_accepted_at")
    .single();

  if (insertError || !created) {
    console.error("Erro ao inserir autorização:", insertError?.message);
    return jsonResponse(
      { success: false, message: "Não foi possível registrar a autorização." },
      500,
    );
  }
  console.log("[create-withdrawal-authorization] authorization_created", created.id, created.protocol);

  // Generate PDF
  let pdfGenerated = false;
  let signedUrl: string | null = null;

  try {
    console.log("[create-withdrawal-authorization] pdf_started");
    const bytes = await renderPdf({
      protocol: created.protocol,
      submittedAt: created.submitted_at,
      termsAcceptedAt: created.terms_accepted_at,
      seller: { name: seller.name, department: seller.department },
      buyer: {
        name: input.buyer_name,
        cpf: input.buyer_cpf,
        phone: input.buyer_phone,
        orderNumber: input.order_number,
      },
      authorized: {
        name: input.authorized_person_name,
        cpf: input.authorized_person_cpf,
      },
      products: input.products_description,
      notes: input.customer_notes,
    });

    const year = created.protocol.split("-")[1] ?? new Date().getFullYear().toString();
    const filename = `${created.protocol}.pdf`;
    const path = `${year}/${filename}`;

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error(`upload_failed: ${uploadError.message}`);

    const { error: updateError } = await admin
      .from("withdrawal_authorizations")
      .update({
        pdf_path: path,
        pdf_filename: filename,
        pdf_generated_at: new Date().toISOString(),
        pdf_generation_status: "generated",
        pdf_generation_error: null,
      })
      .eq("id", created.id);
    if (updateError) throw new Error(`db_update_failed: ${updateError.message}`);

    const { data: signed, error: signedError } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signedError || !signed?.signedUrl) {
      throw new Error(`signed_url_failed: ${signedError?.message ?? "unknown"}`);
    }
    signedUrl = signed.signedUrl;
    pdfGenerated = true;
    console.log("[create-withdrawal-authorization] pdf_completed");
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[create-withdrawal-authorization] pdf_error:", message);
    await admin
      .from("withdrawal_authorizations")
      .update({
        pdf_generation_status: "failed",
        pdf_generation_error: message.slice(0, 500),
      })
      .eq("id", created.id);
  }

  if (pdfGenerated && signedUrl) {
    // Fire the n8n webhook (informational only — failure never blocks the response)
    try {
      console.log("[create-withdrawal-authorization] webhook_started");
      const webhookPayload = {
        event: "withdrawal_authorization.created",
        authorization_id: created.id,
        protocol: created.protocol,
        seller: {
          id: seller.id,
          name: seller.name,
          phone: seller.phone,
          department: seller.department,
        },
        buyer: {
          name: input.buyer_name,
          phone: input.buyer_phone,
        },
        authorized_person: {
          name: input.authorized_person_name,
        },
        order_number: input.order_number,
        pdf_signed_url: signedUrl,
        pdf_filename: `${created.protocol}.pdf`,
        created_at: created.submitted_at,
      };
      const outcome = await sendN8nWebhook(webhookPayload);
      if (outcome.ok) {
        await admin
          .from("withdrawal_authorizations")
          .update({
            webhook_status: "sent",
            webhook_sent_at: new Date().toISOString(),
            webhook_error: null,
            webhook_attempts: 1,
          })
          .eq("id", created.id);
        console.log("[create-withdrawal-authorization] webhook_sent");
      } else {
        await admin
          .from("withdrawal_authorizations")
          .update({
            webhook_status: "failed",
            webhook_error: outcome.error.slice(0, 500),
            webhook_attempts: 1,
          })
          .eq("id", created.id);
        console.warn("[create-withdrawal-authorization] webhook_failed", outcome.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      console.error("[create-withdrawal-authorization] webhook_error", message);
      await admin
        .from("withdrawal_authorizations")
        .update({
          webhook_status: "failed",
          webhook_error: message.slice(0, 500),
          webhook_attempts: 1,
        })
        .eq("id", created.id);
    }

    return jsonResponse({
      success: true,
      authorization_id: created.id,
      protocol: created.protocol,
      pdf_generated: true,
      pdf_download_url: signedUrl,
    });
  }

  return jsonResponse({
    success: true,
    authorization_id: created.id,
    protocol: created.protocol,
    pdf_generated: false,
    message: "A autorização foi registrada, mas o PDF não pôde ser gerado.",
  });
});
