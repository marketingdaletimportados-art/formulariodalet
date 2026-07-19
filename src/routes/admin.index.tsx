import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DaletLogo } from "@/components/dalet-logo";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Acesso administrativo — Dalet Importados" }],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/admin/dashboard", replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim()) return setErrorMsg("Informe seu e-mail.");
    if (!password) return setErrorMsg("Informe sua senha.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("invalid")) {
          setErrorMsg("E-mail ou senha incorretos.");
        } else {
          setErrorMsg("Não foi possível realizar o login. Tente novamente.");
        }
        return;
      }
      navigate({ to: "/admin/dashboard", replace: true });
    } catch {
      setErrorMsg("Não foi possível realizar o login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      toast.success("Enviamos as instruções de recuperação para o e-mail informado.");
      setResetOpen(false);
      setResetEmail("");
    } catch {
      toast.success("Enviamos as instruções de recuperação para o e-mail informado.");
      setResetOpen(false);
    } finally {
      setResetLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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
            <form className="grid gap-4" onSubmit={handleLogin}>
              <div className="grid gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="voce@dalet.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="senha">Senha</Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {errorMsg && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMsg}</p>
              )}
              <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={() => setResetOpen(true)}
                >
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

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe o e-mail cadastrado para receber as instruções de recuperação.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReset} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="reset-email">E-mail</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="voce@dalet.com.br"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                disabled={resetLoading}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)} disabled={resetLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  "Enviar instruções"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
