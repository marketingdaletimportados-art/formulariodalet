import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DaletLogo } from "@/components/dalet-logo";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Definir nova senha — Dalet Importados" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase parses the recovery hash and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("A senha deve ter pelo menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError("Não foi possível atualizar a senha. Solicite um novo link de recuperação.");
        return;
      }
      toast.success("Senha atualizada com sucesso.");
      await supabase.auth.signOut();
      navigate({ to: "/admin", replace: true });
    } catch {
      setError("Não foi possível atualizar a senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <DaletLogo />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Definir nova senha</CardTitle>
            <CardDescription>
              {ready
                ? "Escolha uma nova senha para acessar o painel."
                : "Verificando link de recuperação..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ready ? (
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      aria-label={show ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <Input
                    id="confirm-password"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={loading}
                  />
                </div>
                {error && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                    </>
                  ) : (
                    "Salvar nova senha"
                  )}
                </Button>
              </form>
            ) : (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
