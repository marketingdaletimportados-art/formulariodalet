import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { DaletLogo } from "@/components/dalet-logo";
import { User, UserCheck, PackageSearch, MessageSquare, FileCheck2, CheckCircle2, AlertTriangle, Loader2, Download } from "lucide-react";
import { maskCPF, maskPhone, isValidCPF } from "@/lib/formatters";
import { generateInitialAuthorizationPdf } from "@/lib/authorization-pdf.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/autorizacao/$slug")({
  head: () => ({
    meta: [
      { title: "Autorização para Retirada — Dalet Importados" },
      { name: "description", content: "Preencha os dados para autorizar a retirada da sua mercadoria." },
    ],
  }),
  component: AutorizacaoPage,
});

const schema = z.object({
  compradorNome: z.string().trim().min(3, "Informe o nome completo").max(120, "Máximo de 120 caracteres"),
  compradorCPF: z.string().refine(isValidCPF, "CPF inválido"),
  compradorTelefone: z.string().refine(
    (v) => { const d = v.replace(/\D/g, ""); return d.length >= 10 && d.length <= 11; },
    "Telefone inválido",
  ),
  pedido: z.string().trim().min(1, "Informe o número do pedido").max(30, "Máximo de 30 caracteres"),
  autorizadoNome: z.string().trim().min(3, "Informe o nome completo").max(120, "Máximo de 120 caracteres"),
  autorizadoCPF: z.string().refine(isValidCPF, "CPF inválido"),
  produtos: z.string().trim().min(3, "Descreva os produtos autorizados").max(1000, "Máximo de 1000 caracteres"),
  observacoes: z.string().trim().max(500, "Máximo de 500 caracteres").optional(),
  termo: z.literal(true, { errorMap: () => ({ message: "É necessário confirmar a autorização" }) }),
});

type FormData = z.infer<typeof schema>;

type SuccessInfo = {
  protocol: string;
  buyerName: string;
  authorizedName: string;
  orderNumber: string;
  sellerName: string;
  authorizationId: string;
  pdfSignedUrl: string | null;
  pdfFilename: string | null;
  pdfError: string | null;
};

function AutorizacaoPage() {
  const { slug } = Route.useParams();

  const sellerQuery = useQuery({
    queryKey: ["public-seller", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, name, department, active")
        .eq("slug", slug)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (sellerQuery.isLoading) {
    return <CenteredMessage><Loader2 className="h-6 w-6 animate-spin text-primary" /></CenteredMessage>;
  }

  if (!sellerQuery.data) {
    return (
      <CenteredMessage>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold">Link indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Este link de autorização não está disponível. Entre em contato com seu vendedor.
        </p>
      </CenteredMessage>
    );
  }

  return <AutorizacaoForm seller={sellerQuery.data} />;
}

function AutorizacaoForm({ seller }: { seller: { id: string; name: string; department: string | null } }) {
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      compradorNome: "", compradorCPF: "", compradorTelefone: "", pedido: "",
      autorizadoNome: "", autorizadoCPF: "", produtos: "", observacoes: "",
      termo: undefined as unknown as true,
    },
    mode: "onBlur",
  });

  const values = form.watch();
  const termo = useMemo(() => buildTermo(values), [values]);

  async function onSubmit(data: FormData) {
    setSubmitError(null);
    const now = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("withdrawal_authorizations")
      .insert({
        seller_id: seller.id,
        buyer_name: data.compradorNome.trim(),
        buyer_cpf: data.compradorCPF,
        buyer_phone: data.compradorTelefone,
        order_number: data.pedido.trim(),
        authorized_person_name: data.autorizadoNome.trim(),
        authorized_person_cpf: data.autorizadoCPF,
        products_description: data.produtos.trim(),
        customer_notes: data.observacoes?.trim() || null,
        terms_accepted: true,
        terms_accepted_at: now,
        status: "awaiting_pickup",
      })
      .select("protocol")
      .single();

    if (error || !created) {
      setSubmitError("Não foi possível gerar a autorização. Verifique os dados e tente novamente.");
      return;
    }

    setSuccess({
      protocol: created.protocol,
      buyerName: data.compradorNome.trim(),
      authorizedName: data.autorizadoNome.trim(),
      orderNumber: data.pedido.trim(),
      sellerName: seller.name,
    });
  }

  if (success) {
    return <SuccessScreen info={success} />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <DaletLogo />
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            Vendedor responsável
            <div className="text-sm font-medium text-foreground">{seller.name}</div>
            {seller.department && <div className="text-xs text-muted-foreground">{seller.department}</div>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Autorização para Retirada de Mercadoria
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Preencha rapidamente os dados abaixo para autorizar outra pessoa a retirar sua mercadoria.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs sm:hidden">
            Vendedor: <strong className="text-foreground">{seller.name}</strong>
            {seller.department && <span className="text-muted-foreground">· {seller.department}</span>}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
            <SectionCard icon={User} title="Dados do comprador">
              <FormField control={form.control} name="compradorNome" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome completo <Req /></FormLabel>
                  <FormControl><Input placeholder="Ex: João da Silva" autoComplete="name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="compradorCPF" render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF <Req /></FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="000.000.000-00" {...field}
                      onChange={(e) => field.onChange(maskCPF(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="compradorTelefone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone (WhatsApp) <Req /></FormLabel>
                  <FormControl>
                    <Input inputMode="tel" placeholder="(00) 00000-0000" {...field}
                      onChange={(e) => field.onChange(maskPhone(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="pedido" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Número do pedido ou da venda <Req /></FormLabel>
                  <FormControl><Input placeholder="Ex: 12345" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </SectionCard>

            <SectionCard icon={UserCheck} title="Pessoa autorizada">
              <FormField control={form.control} name="autorizadoNome" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Nome completo <Req /></FormLabel>
                  <FormControl><Input placeholder="Ex: Maria Souza" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="autorizadoCPF" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>CPF <Req /></FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" placeholder="000.000.000-00" {...field}
                      onChange={(e) => field.onChange(maskCPF(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </SectionCard>

            <SectionCard icon={PackageSearch} title="Produtos">
              <FormField control={form.control} name="produtos" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Produtos autorizados para retirada <Req /></FormLabel>
                  <FormControl>
                    <Textarea rows={4}
                      placeholder={"Ex: iPhone 16 Pro Max\nTV Xiaomi 55\"\nTodos os produtos do pedido"}
                      {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </SectionCard>

            <SectionCard icon={MessageSquare} title="Observações" description="Campo opcional.">
              <FormField control={form.control} name="observacoes" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Alguma informação adicional? (opcional)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </SectionCard>

            <SectionCard icon={FileCheck2} title="Termo de autorização">
              <div className="sm:col-span-2 whitespace-pre-line rounded-md border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                {termo}
              </div>
              <FormField control={form.control} name="termo" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <div className="flex items-start gap-3">
                    <FormControl>
                      <Checkbox
                        checked={field.value === true}
                        onCheckedChange={(c) => field.onChange(c === true ? true : undefined)}
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal leading-relaxed">
                      Declaro que li e autorizo a pessoa acima informada a retirar minha mercadoria. <Req />
                    </FormLabel>
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
            </SectionCard>

            {submitError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <div className="sticky bottom-4 z-10">
              <Button
                type="submit"
                size="lg"
                className="h-14 w-full text-base shadow-lg"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando autorização...</>
                ) : "Gerar autorização"}
              </Button>
            </div>
          </form>
        </Form>
      </main>
    </div>
  );
}

function SuccessScreen({ info }: { info: SuccessInfo }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4"><DaletLogo /></div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="mt-3 text-2xl">Autorização gerada com sucesso!</CardTitle>
            <CardDescription>Guarde as informações abaixo para conferência.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <InfoRow label="Protocolo" value={info.protocol} mono />
            <InfoRow label="Comprador" value={info.buyerName} />
            <InfoRow label="Pessoa autorizada" value={info.authorizedName} />
            <InfoRow label="Número do pedido" value={info.orderNumber} />
            <InfoRow label="Vendedor responsável" value={info.sellerName} />
            <div className="mt-4 rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900">
              A pessoa autorizada deverá apresentar documento oficial com foto no momento da retirada.
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b py-2 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-lg border bg-background p-8 text-center shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Req() {
  return <span className="text-destructive" aria-label="obrigatório">*</span>;
}

function SectionCard({
  icon: Icon, title, description, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function buildTermo(v: Partial<FormData>) {
  const nomeC = v.compradorNome?.trim() || "[Nome do comprador]";
  const cpfC = v.compradorCPF?.trim() || "[CPF do comprador]";
  const nomeA = v.autorizadoNome?.trim() || "[Nome da pessoa autorizada]";
  const cpfA = v.autorizadoCPF?.trim() || "[CPF da pessoa autorizada]";
  const pedido = v.pedido?.trim() || "[Número do pedido]";
  return `Eu, ${nomeC}, inscrito(a) no CPF ${cpfC}, autorizo ${nomeA}, inscrito(a) no CPF ${cpfA}, a retirar em meu nome os produtos descritos neste formulário, referentes ao pedido nº ${pedido}, adquirido na Dalet Importados.

Declaro que todas as informações prestadas são verdadeiras e assumo total responsabilidade por esta autorização.

Estou ciente de que a pessoa autorizada deverá apresentar seu CPF ou documento oficial com foto no momento da retirada para conferência.`;
}
