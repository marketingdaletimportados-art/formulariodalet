import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DaletLogo } from "@/components/dalet-logo";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [{ title: "Acesso administrativo — Dalet Importados" }],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <DaletLogo />
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle>Painel Administrativo</CardTitle>
            <CardDescription>Acesso restrito à equipe autorizada da Dalet Importados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="voce@dalet.com.br" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" placeholder="••••••••" />
              </div>
              <Button asChild size="lg" className="h-12 w-full text-base">
                <Link to="/admin/dashboard">Entrar</Link>
              </Button>
              <div className="text-center">
                <button type="button" className="text-sm text-primary hover:underline">
                  Esqueci minha senha
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Voltar para o início</Link>
        </p>
      </div>
    </div>
  );
}
