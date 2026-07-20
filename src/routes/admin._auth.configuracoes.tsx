import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Webhook, Database, FileText, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_auth/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Dalet Importados" }] }),
  component: SettingsPage,
});

type Settings = {
  id: string;
  webhook_enabled: boolean;
  webhook_url: string | null;
  has_webhook_secret: boolean;
  pdf_signed_url_expiration_minutes: number;
};

function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newSecret, setNewSecret] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError(null);
      // Do NOT select webhook_secret — it is never sent to the browser.
      const { data, error } = await supabase
        .from("system_settings")
        .select("id, webhook_enabled, webhook_url, pdf_signed_url_expiration_minutes, webhook_secret")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) {
        setLoadError("Não foi possível carregar as configurações. Verifique se você tem permissão de administrador.");
        setLoading(false);
        return;
      }
      if (!data) {
        const { data: created, error: insertError } = await supabase
          .from("system_settings")
          .insert({
            webhook_enabled: false,
            webhook_url: "",
            webhook_secret: "",
            pdf_signed_url_expiration_minutes: 15,
          })
          .select("id, webhook_enabled, webhook_url, pdf_signed_url_expiration_minutes, webhook_secret")
          .single();
        if (insertError || !created) {
          setLoadError("Não foi possível carregar as configurações.");
        } else {
          setSettings({
            id: created.id,
            webhook_enabled: created.webhook_enabled,
            webhook_url: created.webhook_url,
            pdf_signed_url_expiration_minutes: created.pdf_signed_url_expiration_minutes,
            has_webhook_secret: !!created.webhook_secret,
          });
        }
      } else {
        setSettings({
          id: data.id,
          webhook_enabled: data.webhook_enabled,
          webhook_url: data.webhook_url,
          pdf_signed_url_expiration_minutes: data.pdf_signed_url_expiration_minutes,
          has_webhook_secret: !!data.webhook_secret,
        });
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const minutes = Math.max(1, Math.min(1440, Number(settings.pdf_signed_url_expiration_minutes) || 15));
    // deno-lint-ignore no-explicit-any
    const payload: Record<string, unknown> = {
      webhook_enabled: settings.webhook_enabled,
      webhook_url: settings.webhook_url ?? "",
      pdf_signed_url_expiration_minutes: minutes,
    };
    if (newSecret.trim()) payload.webhook_secret = newSecret.trim();
    const { error } = await supabase
      .from("system_settings")
      .update(payload)
      .eq("id", settings.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar as configurações. Tente novamente.");
      return;
    }
    if (newSecret.trim()) {
      setSettings({ ...settings, has_webhook_secret: true });
      setNewSecret("");
    }
    toast.success("Configurações salvas com sucesso.");
  }

  return (
    <AdminLayout title="Configurações">
      <div className="mx-auto grid w-full max-w-4xl gap-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-destructive">{loadError}</CardContent>
          </Card>
        ) : settings ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5 text-primary" />
                  Integração de notificações
                </CardTitle>
                <CardDescription>
                  Configure o webhook do n8n que será usado para enviar as autorizações aos vendedores.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-5" onSubmit={handleSave}>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <div className="font-medium">Ativar webhook</div>
                      <div className="text-sm text-muted-foreground">
                        Quando ativo, novas autorizações serão enviadas para a URL configurada.
                      </div>
                    </div>
                    <Switch
                      checked={settings.webhook_enabled}
                      onCheckedChange={(v) => setSettings({ ...settings, webhook_enabled: v })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="webhook_url">URL do webhook do n8n</Label>
                    <Input
                      id="webhook_url"
                      type="url"
                      placeholder="https://n8n.suaempresa.com/webhook/..."
                      value={settings.webhook_url ?? ""}
                      onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="webhook_secret">Segredo do webhook</Label>
                    <Input
                      id="webhook_secret"
                      type="password"
                      placeholder="••••••••"
                      value={settings.webhook_secret ?? ""}
                      onChange={(e) => setSettings({ ...settings, webhook_secret: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Usado para validar a origem das requisições enviadas ao n8n.
                    </p>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="pdf_ttl">Tempo de validade do link do PDF (minutos)</Label>
                    <Input
                      id="pdf_ttl"
                      type="number"
                      min={1}
                      max={1440}
                      value={settings.pdf_signed_url_expiration_minutes}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          pdf_signed_url_expiration_minutes: Number(e.target.value),
                        })
                      }
                    />
                    <p className="text-xs text-muted-foreground">Sugerido: 15 minutos.</p>
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit" disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
                        </>
                      ) : (
                        "Salvar configurações"
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  Dados do sistema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <InfoRow label="Nome do sistema" value="Autorização de Retirada" />
                  <InfoRow label="Empresa" value="Dalet Importados" />
                  <InfoRow
                    label="Status do Supabase"
                    value={<Badge className="bg-emerald-600 hover:bg-emerald-600">Conectado</Badge>}
                  />
                  <InfoRow
                    label="Geração de PDF"
                    value={<Badge className="bg-emerald-600 hover:bg-emerald-600">Ativa</Badge>}
                  />
                  <InfoRow
                    label="Webhook"
                    value={
                      settings.webhook_enabled && (settings.webhook_url ?? "").trim() ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )
                    }
                  />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Segurança
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 text-sm">
                  <SecurityItem icon={Lock} text="Bucket de PDFs privado" />
                  <SecurityItem icon={ShieldCheck} text="Row Level Security (RLS) ativo" />
                  <SecurityItem icon={Lock} text="Painel protegido por login" />
                  <SecurityItem icon={FileText} text="URLs assinadas temporárias para acesso aos PDFs" />
                </ul>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function SecurityItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
      <Icon className="h-4 w-4 text-primary" />
      <span>{text}</span>
    </li>
  );
}
