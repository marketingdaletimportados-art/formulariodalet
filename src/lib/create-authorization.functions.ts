import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isValidCPF } from "./formatters";
import type { Database } from "@/integrations/supabase/types";

const payloadSchema = z.object({
  seller_slug: z.string().trim().min(1).max(120),
  buyer_name: z.string().trim().min(3).max(120),
  buyer_cpf: z.string(),
  buyer_phone: z.string(),
  order_number: z.string().trim().min(1).max(30),
  authorized_person_name: z.string().trim().min(3).max(120),
  authorized_person_cpf: z.string(),
  products_description: z.string().trim().min(3).max(1000),
  customer_notes: z.string().trim().max(500).optional().nullable(),
  terms_accepted: z.literal(true),
});

function digits(v: string) {
  return v.replace(/\D/g, "");
}

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createServerSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase runtime não configurado (SUPABASE_URL/SUPABASE_PUBLISHABLE_KEY).");
  }
  return createClient<Database>(url, key, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const createWithdrawalAuthorization = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payloadSchema.parse(data))
  .handler(async ({ data }) => {
    const buyerCpf = digits(data.buyer_cpf);
    const authorizedCpf = digits(data.authorized_person_cpf);
    const buyerPhone = digits(data.buyer_phone);

    if (!isValidCPF(buyerCpf)) {
      return { ok: false as const, error: "invalid_buyer_cpf" };
    }
    if (!isValidCPF(authorizedCpf)) {
      return { ok: false as const, error: "invalid_authorized_cpf" };
    }
    if (buyerPhone.length < 10 || buyerPhone.length > 11) {
      return { ok: false as const, error: "invalid_phone" };
    }

    const supabase = createServerSupabaseClient();

    const { data: seller, error: sellerError } = await supabase
      .from("sellers")
      .select("id, active")
      .eq("slug", data.seller_slug)
      .maybeSingle();

    if (sellerError) {
      console.error("[create-authorization] seller lookup failed:", sellerError);
      return { ok: false as const, error: "seller_lookup_failed" };
    }
    if (!seller || !seller.active) {
      return { ok: false as const, error: "seller_unavailable" };
    }

    const now = new Date().toISOString();
    const { data: created, error: insertError } = await supabase
      .from("withdrawal_authorizations")
      .insert({
        seller_id: seller.id,
        buyer_name: data.buyer_name.trim(),
        buyer_cpf: buyerCpf,
        buyer_phone: buyerPhone,
        order_number: data.order_number.trim(),
        authorized_person_name: data.authorized_person_name.trim(),
        authorized_person_cpf: authorizedCpf,
        products_description: data.products_description.trim(),
        customer_notes: data.customer_notes?.trim() || null,
        terms_accepted: true,
        terms_accepted_at: now,
        status: "awaiting_pickup",
        pdf_generation_status: "pending",
      })
      .select("id, protocol")
      .single();

    if (insertError || !created) {
      console.error("[create-authorization] insert failed:", insertError);
      return { ok: false as const, error: "insert_failed" };
    }

    return { ok: true as const, id: created.id, protocol: created.protocol };
  });
