import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { DaletLogo } from "@/components/dalet-logo";
import { User, UserCheck, PackageSearch, MessageSquare, FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/autorizacao/$slug")({
  head: () => ({
    meta: [
      { title: "Autorização para Retirada — Dalet Importados" },
      { name: "description", content: "Preencha os dados para autorizar a retirada da sua mercadoria." },
    ],
  }),
  component: AutorizacaoPage,
});

// ---------- Máscaras e validação ----------
function maskCPF(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) =>
      [a && `(${a}`, a && a.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""));
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
}
function isValidCPF(cpf: string) {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(c[i]) * (10 - i);
  let d1 = (s * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(c[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(c[i]) * (11 - i);
  let d2 = (s * 10) % 11;
  if (d2 === 10) d2 = 0;
  return d2 === parseInt(c[10]);
}

const schema = z.object({
  compradorNome: z.string().trim().min(3, "Informe o nome completo").max(120, "Máximo de 120 caracteres"),
  compradorCPF: z.string().refine(isValidCPF, "CPF inválido"),
  compradorTelefone: z.string().refine(
    (v) => v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 11,
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

function AutorizacaoPage() {
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

  function onSubmit(_data: FormData) {
    // Integração futura
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <DaletLogo />
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            Vendedor responsável
            <div className="text-sm font-medium text-foreground">— a definir —</div>
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
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
            {/* Comprador */}
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

            {/* Pessoa autorizada */}
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

            {/* Produtos */}
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

            {/* Observações */}
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

            {/* Termo */}
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

            <div className="sticky bottom-4 z-10">
              <Button type="submit" size="lg" className="h-14 w-full text-base shadow-lg">
                Gerar autorização
              </Button>
            </div>
          </form>
        </Form>
      </main>
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
