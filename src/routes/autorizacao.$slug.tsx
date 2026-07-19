import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DaletLogo } from "@/components/dalet-logo";
import { User, UserCheck, ShoppingBag, FileCheck2 } from "lucide-react";

export const Route = createFileRoute("/autorizacao/$slug")({
  head: () => ({
    meta: [
      { title: "Autorização para Retirada — Dalet Importados" },
      { name: "description", content: "Preencha os dados para autorizar a retirada da sua mercadoria." },
    ],
  }),
  component: AutorizacaoPage,
});

function Section({
  icon: Icon,
  title,
  description,
  children,
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

function Field({
  label,
  id,
  ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
    </div>
  );
}

function AutorizacaoPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <DaletLogo />
          <div className="hidden text-right text-xs text-muted-foreground sm:block">
            Vendedor responsável
            <div className="text-sm font-medium text-foreground">— a definir —</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Autorização para Retirada de Mercadoria
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            Preencha os dados abaixo para autorizar outra pessoa a retirar sua mercadoria em nossa loja.
            Todos os campos são obrigatórios.
          </p>
        </div>

        <form className="grid gap-6">
          <Section icon={User} title="Dados do comprador" description="Informações da pessoa que realizou a compra.">
            <Field label="Nome completo" id="comprador-nome" placeholder="Ex: João da Silva" />
            <Field label="CPF" id="comprador-cpf" placeholder="000.000.000-00" />
            <Field label="Telefone / WhatsApp" id="comprador-tel" placeholder="(00) 00000-0000" />
            <Field label="E-mail" id="comprador-email" type="email" placeholder="voce@exemplo.com" />
          </Section>

          <Section icon={UserCheck} title="Dados da pessoa autorizada" description="Quem irá retirar a mercadoria em seu nome.">
            <Field label="Nome completo" id="aut-nome" placeholder="Ex: Maria Souza" />
            <Field label="CPF" id="aut-cpf" placeholder="000.000.000-00" />
            <Field label="RG" id="aut-rg" placeholder="00.000.000-0" />
            <Field label="Telefone" id="aut-tel" placeholder="(00) 00000-0000" />
          </Section>

          <Section icon={ShoppingBag} title="Dados da compra e retirada" description="Informações do pedido.">
            <Field label="Número do pedido" id="pedido-num" placeholder="Ex: 12345" />
            <Field label="Data prevista de retirada" id="pedido-data" type="date" />
            <div className="sm:col-span-2 grid gap-1.5">
              <Label htmlFor="pedido-desc">Descrição do pedido</Label>
              <Textarea id="pedido-desc" placeholder="Descreva os itens do pedido..." rows={3} />
            </div>
          </Section>

          <Section icon={FileCheck2} title="Termo de autorização" description="Leia e confirme para prosseguir.">
            <div className="sm:col-span-2 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              Autorizo a pessoa acima identificada a retirar, em meu nome, a mercadoria referente ao pedido informado
              na loja Dalet Importados, assumindo total responsabilidade pelos dados prestados e pela entrega efetuada.
            </div>
            <div className="sm:col-span-2 flex items-start gap-2">
              <Checkbox id="termo" />
              <Label htmlFor="termo" className="text-sm font-normal leading-relaxed">
                Li e concordo com o termo de autorização acima.
              </Label>
            </div>
          </Section>

          <div className="sticky bottom-4 z-10">
            <Button type="button" size="lg" className="h-14 w-full text-base shadow-lg">
              Confirmar e gerar autorização
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
