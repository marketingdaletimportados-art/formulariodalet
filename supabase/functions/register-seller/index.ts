// Supabase Edge Function: register-seller
// Public endpoint used by the seller self-registration page (/cadastro).
// Validates input, normalizes Paraguay phone to +595, generates a unique slug
// and inserts the seller using the service role. Never exposes internal data.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function digits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function isValidPersonName(v: string): boolean {
  const s = (v ?? "").trim();
  if (s.length < 3 || s.length > 120) return false;
  if (/\d/.test(s)) return false;
  if (!/^[\p{L}\s'’\-]+$/u.test(s)) return false;
  const letters = (s.match(/\p{L}/gu) ?? []).length;
  return letters >= 2;
}

function normalizeNameDisplay(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

// Paraguay phone normalization: always prefix +595. Strip leading 0 from
// mobile prefixes (e.g. 0981 -> 981). Final format: 595 + 9-10 digits.
function normalizeParaguayPhone(raw: string): string | null {
  let d = digits(raw);
  if (!d) return null;
  if (d.startsWith("595")) d = d.slice(3);
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  // Paraguay national number is typically 9 digits (mobile) or 8-10 range.
  if (d.length < 8 || d.length > 11) return null;
  const full = "595" + d;
  if (full.length < 11 || full.length > 15) return null;
  return full;
}

function slugify(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// Simple in-memory rate limit (per instance). Best-effort; the edge runtime
// may recycle instances, so this is a soft throttle only.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const rateBucket = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (rateBucket.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  rateBucket.set(ip, arr);
  return arr.length > RATE_LIMIT_MAX;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "Método não permitido." }, 405);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  if (rateLimited(ip)) {
    return jsonResponse(
      { success: false, error: "Muitas tentativas. Aguarde alguns instantes e tente novamente." },
      429,
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ success: false, error: "Requisição inválida." }, 400);
  }

  // Honeypot: reject silently (return success shape) so bots don't retry.
  const honeypot = typeof payload.website === "string" ? payload.website : "";
  if (honeypot.trim().length > 0) {
    return jsonResponse({ success: true, message: "Cadastro realizado com sucesso." });
  }

  const nameRaw = typeof payload.name === "string" ? payload.name : "";
  const phoneRaw = typeof payload.phone === "string" ? payload.phone : "";
  const sectorId = typeof payload.sector_id === "string" ? payload.sector_id : "";

  if (!isValidPersonName(nameRaw)) {
    return jsonResponse({ success: false, error: "Informe seu nome completo corretamente." }, 400);
  }

  const phone = normalizeParaguayPhone(phoneRaw);
  if (!phone) {
    return jsonResponse(
      { success: false, error: "Informe um número de WhatsApp válido do Paraguai." },
      400,
    );
  }

  if (!/^[0-9a-f-]{36}$/i.test(sectorId)) {
    return jsonResponse({ success: false, error: "Selecione um setor válido." }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ success: false, error: "Serviço indisponível no momento." }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Validate sector exists and is active
  const { data: sector, error: sectorErr } = await admin
    .from("sectors")
    .select("id, name, active")
    .eq("id", sectorId)
    .maybeSingle();
  if (sectorErr || !sector || !sector.active) {
    return jsonResponse({ success: false, error: "Selecione um setor válido." }, 400);
  }

  // Duplicate phone check
  const { data: existingPhone } = await admin
    .from("sellers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (existingPhone) {
    return jsonResponse(
      {
        success: false,
        error:
          "Este número de WhatsApp já está cadastrado. Entre em contato com o administrador caso precise atualizar seus dados.",
      },
      409,
    );
  }

  const cleanName = normalizeNameDisplay(nameRaw);
  const baseSlug = slugify(cleanName) || "vendedor";

  // Generate unique slug with numeric suffix if needed
  let slug = baseSlug;
  for (let i = 2; i < 200; i++) {
    const { data: existing } = await admin
      .from("sellers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${i}`;
  }

  const insertPayload = {
    name: cleanName,
    slug,
    phone,
    department: sector.name,
    sector_id: sector.id,
    active: true,
    registration_source: "public_registration",
  };

  const { error: insertErr } = await admin.from("sellers").insert(insertPayload);
  if (insertErr) {
    // Unique constraint fallback (race)
    if (insertErr.code === "23505") {
      return jsonResponse(
        { success: false, error: "Este número de WhatsApp já está cadastrado." },
        409,
      );
    }
    console.error("[register-seller] insert error:", insertErr.message);
    return jsonResponse({ success: false, error: "Não foi possível concluir o cadastro." }, 500);
  }

  return jsonResponse({ success: true, message: "Cadastro realizado com sucesso." });
});
