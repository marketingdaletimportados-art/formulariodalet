import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { DaletLogo } from "@/components/dalet-logo";
import { ShieldCheck, FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Autorização de Retirada — Dalet Importados" },
      { name: "description", content: "Sistema de autorização de retirada de mercadorias da Dalet Importados." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-background">
      <header className="border-b bg-background/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <DaletLogo />
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:py-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Sistema oficial Dalet Importados
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
          Autorização de Retirada de Mercadoria
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Emissão rápida, segura e organizada das autorizações para retirada de pedidos.
          Escolha abaixo como deseja continuar.
        </p>

        <div className="mt-10 grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Button asChild size="lg" className="h-14 text-base">
            <Link to="/admin">
              <ShieldCheck className="mr-2 h-5 w-5" />
              Painel administrativo
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14 text-base">
            <Link to="/autorizacao/$slug" params={{ slug: "exemplo" }}>
              <FileText className="mr-2 h-5 w-5" />
              Preencher autorização
            </Link>
          </Button>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Dalet Importados — Todos os direitos reservados.
        </p>
      </main>
    </div>
  );
}
