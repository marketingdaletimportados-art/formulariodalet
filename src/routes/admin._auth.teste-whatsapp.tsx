import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, MessageSquare, Send, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendWhatsappTest } from "@/lib/webhook-test.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/_auth/teste-whatsapp")({
  head: () => ({
    meta: [
      { title: "Teste WhatsApp — Dalet Importados" },
      { name: "description", content: "Ferramenta para validar o envio de mensagens WhatsApp via n8n e Evolution API." },
    ],
  }),
  component: TestWhatsappPage,
});

type Seller = {
  id: string;
  name: string;
  department: string | null;
  phone: string;
  active: boolean;
};

type LogRow = {
  id: string;
  seller_name: string;
  seller_phone: string;
  with_pdf: boolean;
  success: boolean;
  http_status: number | null;
  response_excerpt: string | null;
  error: string | null;
  created_at: string;
};

function TestWhatsappPage() {
  const [sellerId, setSellerId] = useState<string>("");
  const [withPdf, setWithPdf] = useState(true);
  const qc = useQueryClient();
  const sendTest = useServerFn(sendWhatsappTest);

  const sellersQuery = useQuery({
    queryKey: ["test-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, name, department, phone, active")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Seller[];
    },
  });

  const logsQuery = useQuery({
    queryKey: ["webhook-test-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("webhook_test_logs")
        .select("id, seller_name, seller_phone, with_pdf, success, http_status, response_excerpt, error, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  useEffect(() => {
    if (!sellerId && sellersQuery.data && sellersQuery.data.length > 0) {
      const firstActive = sellersQuery.data.find((s) => s.active) ?? sellersQuery.data[0];
      setSellerId(firstActive.id);
    }
  }, [sellersQuery.data, sellerId]);

  const selectedSeller = useMemo(
    () => sellersQuery.data?.find((s) => s.id === sellerId) ?? null,
    [sellersQuery.data, sellerId],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!sellerId) throw new Error("seller_required");
      return await sendTest({ data: { sellerId, withPdf } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["webhook-test-logs"] });
      if (res.ok) toast.success("Teste enviado com sucesso ao n8n.");
      else toast.error(errorLabel(res.error ?? null));
    },
    onError: () => toast.error("Não foi possível enviar o teste."),
  });

  const lastResult = mutation.data;

  return (
    <AdminLayout title="Teste WhatsApp">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Teste de envio WhatsApp
            </CardTitle>
            <CardDescription>
              Valida o fluxo Lovable → Supabase → n8n → Evolution API. Não cria autorização, protocolo ou PDF oficial.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select value={sellerId} onValueChange={setSellerId} disabled={sellersQuery.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={sellersQuery.isLoading ? "Carregando..." : "Selecione um vendedor"} />
                </SelectTrigger>
                <SelectContent>
                  {(sellersQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.department ? ` — ${s.department}` : ""}
                      {!s.active ? " (inativo)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedSeller && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="grid gap-1">
                  <Info label="Nome" value={selectedSeller.name} />
                  <Info label="Setor" value={selectedSeller.department ?? "—"} />
                  <Info label="Telefone" value={selectedSeller.phone} />
                </div>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withPdf} onCheckedChange={(v) => setWithPdf(v === true)} />
              Enviar PDF de exemplo
            </label>

            <Button
              size="lg"
              className="w-full"
              disabled={!sellerId || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Enviar teste</>
              )}
            </Button>

            {lastResult && (
              <div className={`rounded-md border p-3 text-sm ${lastResult.ok ? "border-emerald-200 bg-emerald-50" : "border-destructive/40 bg-destructive/5"}`}>
                <div className="flex items-center gap-2 font-medium">
                  {lastResult.ok ? (
                    <><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Enviado com sucesso</>
                  ) : (
                    <><XCircle className="h-4 w-4 text-destructive" /> Erro no envio</>
                  )}
                </div>
                <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  {"sentAt" in lastResult && lastResult.sentAt && (
                    <div>Horário: {formatDate(lastResult.sentAt)}</div>
                  )}
                  {"httpStatus" in lastResult && lastResult.httpStatus != null && (
                    <div>HTTP status: {lastResult.httpStatus}</div>
                  )}
                  {"error" in lastResult && lastResult.error && (
                    <div>Detalhe: {errorLabel(lastResult.error)}</div>
                  )}
                  {"responseExcerpt" in lastResult && lastResult.responseExcerpt && (
                    <div className="mt-1 whitespace-pre-wrap break-words rounded bg-background/60 p-2 font-mono">
                      {lastResult.responseExcerpt}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos testes</CardTitle>
            <CardDescription>Os 20 envios mais recentes.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>PDF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsQuery.isLoading && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </TableCell></TableRow>
                )}
                {logsQuery.isSuccess && (logsQuery.data?.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum teste realizado ainda.
                  </TableCell></TableRow>
                )}
                {(logsQuery.data ?? []).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.seller_name}</div>
                      <div className="text-xs text-muted-foreground">{l.seller_phone}</div>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(l.created_at)}</TableCell>
                    <TableCell>{l.with_pdf ? "Sim" : "Não"}</TableCell>
                    <TableCell>
                      {l.success ? (
                        <Badge variant="default">Enviado</Badge>
                      ) : (
                        <Badge variant="destructive">Falhou</Badge>
                      )}
                      {l.http_status != null && (
                        <div className="mt-1 text-xs text-muted-foreground">HTTP {l.http_status}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      {l.error ? (
                        <div className="text-xs text-destructive">{errorLabel(l.error)}</div>
                      ) : (
                        <div className="line-clamp-2 whitespace-pre-wrap break-words text-xs">
                          {l.response_excerpt ?? "—"}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function errorLabel(code: string | null) {
  if (!code) return "Erro desconhecido.";
  if (code === "forbidden") return "Acesso negado.";
  if (code === "webhook_not_configured") return "Webhook não configurado. Defina URL e segredo em Configurações.";
  if (code === "seller_not_found") return "Vendedor não encontrado.";
  if (code === "timeout") return "Tempo esgotado ao contactar o n8n.";
  if (code.startsWith("http_")) return `n8n respondeu ${code.replace("http_", "HTTP ")}.`;
  if (code.startsWith("pdf_error")) return "Falha ao preparar o PDF de teste.";
  return code;
}
