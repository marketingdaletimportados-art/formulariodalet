import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DaletLogo } from "@/components/dalet-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, Loader2, Copy, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastro de vendedor — Dalet Importados" },
      { name: "description", content: "Cadastre-se como vendedor da Dalet Importados para receber as autorizações de retirada pelo WhatsApp." },
      { property: "og:title", content: "Cadastro de vendedor — Dalet Importados" },
      { property: "og:description", content: "Cadastre-se como vendedor da Dalet Importados para receber as autorizações de retirada pelo WhatsApp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CadastroPage,
});

const nameRegex = /^[\p{L}\s'’\-]+$/u;

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Informe seu nome completo corretamente.")
    .max(120, "Máximo de 120 caracteres.")
    .refine((v) => !/\d/.test(v), "Informe seu nome completo corretamente.")
    .refine((v) => nameRegex.test(v), "Informe seu nome completo corretamente.")
    .refine((v) => ((v.match(/\p{L}/gu) ?? []).length >= 2), "Informe seu nome completo corretamente."),
  phone: z
    .string()
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 8 && d.length <= 11;
    }, "Informe um número de WhatsApp válido do Paraguai."),
  sector_id: z.string().uuid("Selecione um setor."),
  website: z.string().max(0).optional().or(z.literal("")), // honeypot
});

type FormData = z.infer<typeof schema>;

function maskParaguayPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)}${d.length > 6 ? " " + d.slice(6) : ""}`;
}

function CadastroPage() {
  const [result, setResult] = useState<
    | { name: string; slug: string; authorization_url: string; already_registered: boolean }
    | null
  >(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const sectorsQuery = useQuery({
    queryKey: ["public-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sectors")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", sector_id: "", website: "" },
  });

  const { register, handleSubmit, formState, watch, setValue } = form;
  const { errors, isSubmitting } = formState;
  const phoneValue = watch("phone");
  const sectorValue = watch("sector_id");

  async function onSubmit(data: FormData) {
    setServerError(null);
    const { data: res, error } = await supabase.functions.invoke("register-seller", {
      body: {
        name: data.name,
        phone: data.phone,
        sector_id: data.sector_id,
        website: data.website ?? "",
      },
    });
    if (error) {
      // Try to extract server error message from response context
      const ctx = (error as { context?: Response }).context;
      let msg = "Não foi possível concluir o cadastro. Tente novamente.";
      if (ctx) {
        try {
          const body = await ctx.json();
          if (typeof body?.error === "string") msg = body.error;
        } catch { /* ignore */ }
      }
      setServerError(msg);
      return;
    }
    if (!res?.success) {
      setServerError(res?.error ?? "Não foi possível concluir o cadastro.");
      return;
    }
    setSuccess(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <DaletLogo />
        </div>
      </header>

      <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-10 sm:py-16">
        {success ? (
          <Card className="w-full">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h1 className="text-xl font-semibold">Cadastro concluído!</h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                Seus dados foram registrados corretamente. Você já poderá receber as autorizações de retirada pelo WhatsApp.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Cadastro de vendedor
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Preencha seus dados corretamente para receber as autorizações de retirada pelo WhatsApp.
              </p>
            </div>

            <Card className="w-full">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
                  <div className="grid gap-1.5">
                    <Label htmlFor="c-name">Nome completo <span className="text-destructive">*</span></Label>
                    <Input
                      id="c-name"
                      autoComplete="name"
                      placeholder="Ex: María González"
                      {...register("name")}
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="c-phone">WhatsApp <span className="text-destructive">*</span></Label>
                    <div className="flex">
                      <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm font-medium text-muted-foreground">
                        +595
                      </span>
                      <Input
                        id="c-phone"
                        inputMode="tel"
                        autoComplete="tel-national"
                        placeholder="981 123456"
                        className="rounded-l-none"
                        value={phoneValue}
                        onChange={(e) => setValue("phone", maskParaguayPhone(e.target.value), { shouldValidate: true })}
                      />
                    </div>
                    {errors.phone && (
                      <p className="text-sm text-destructive">{errors.phone.message}</p>
                    )}
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="c-sector">Setor <span className="text-destructive">*</span></Label>
                    <Select
                      value={sectorValue}
                      onValueChange={(v) => setValue("sector_id", v, { shouldValidate: true })}
                    >
                      <SelectTrigger id="c-sector">
                        <SelectValue placeholder={sectorsQuery.isLoading ? "Carregando..." : "Selecione seu setor"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(sectorsQuery.data ?? []).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.sector_id && (
                      <p className="text-sm text-destructive">{errors.sector_id.message}</p>
                    )}
                  </div>

                  {/* Honeypot */}
                  <div className="hidden" aria-hidden="true">
                    <label>
                      Não preencha este campo
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        {...register("website")}
                      />
                    </label>
                  </div>

                  {serverError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {serverError}
                    </div>
                  )}

                  <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Cadastrando...</>
                    ) : "Finalizar cadastro"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}

        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Dalet Importados
        </p>
      </main>
    </div>
  );
}
