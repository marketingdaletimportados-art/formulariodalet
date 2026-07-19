import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, CheckCircle2, XCircle, Loader2, FileText, RefreshCw, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { maskCPFDisplay } from "@/lib/formatters";
import { useServerFn } from "@tanstack/react-start";
import { getAuthorizationPdfSignedUrl, regenerateAuthorizationPdf } from "@/lib/authorization-pdf.functions";

export const Route = createFileRoute("/admin/_auth/autorizacoes")({
  head: () => ({ meta: [{ title: "Autorizações — Dalet Importados" }] }),
  component: AutorizacoesPage,
});

type StatusValue = "all" | "awaiting_pickup" | "picked_up" | "cancelled";

type AuthRow = {
  id: string;
  protocol: string;
  submitted_at: string;
  buyer_name: string;
  buyer_cpf: string;
  buyer_phone: string;
  order_number: string;
  authorized_person_name: string;
  authorized_person_cpf: string;
  products_description: string;
  customer_notes: string | null;
  status: string;
  picked_up_at: string | null;
  cancelled_at: string | null;
  seller_id: string;
  pdf_generation_status: string;
  pdf_filename: string | null;
  pdf_generated_at: string | null;
  sellers: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_pickup: "Aguardando",
  picked_up: "Retirada",
  cancelled: "Cancelada",
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "picked_up") return "default";
  if (status === "cancelled") return "destructive";
  return "secondary";
}

function AutorizacoesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusValue>("all");
  const [viewing, setViewing] = useState<AuthRow | null>(null);

  const query = useQuery({
    queryKey: ["admin-authorizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_authorizations")
        .select("id, protocol, submitted_at, buyer_name, buyer_cpf, buyer_phone, order_number, authorized_person_name, authorized_person_cpf, products_description, customer_notes, status, picked_up_at, cancelled_at, seller_id, pdf_generation_status, pdf_filename, pdf_generated_at, sellers(name)")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AuthRow[];
    },
  });

  const filtered = useMemo(() => {
    const list = query.data ?? [];
    return list.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        r.protocol.toLowerCase().includes(s) ||
        r.buyer_name.toLowerCase().includes(s) ||
        r.authorized_person_name.toLowerCase().includes(s) ||
        r.order_number.toLowerCase().includes(s) ||
        (r.sellers?.name.toLowerCase().includes(s) ?? false)
      );
    });
  }, [query.data, search, statusFilter]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, to }: { id: string; to: "picked_up" | "cancelled" }) => {
      const now = new Date().toISOString();
      const payload = to === "picked_up"
        ? { status: to, picked_up_at: now }
        : { status: to, cancelled_at: now };
      const { error } = await supabase.from("withdrawal_authorizations").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.to === "picked_up" ? "Marcada como retirada" : "Autorização cancelada");
      qc.invalidateQueries({ queryKey: ["admin-authorizations"] });
      setViewing(null);
    },
    onError: () => toast.error("Não foi possível atualizar. Verifique sua permissão."),
  });

  const getSignedUrl = useServerFn(getAuthorizationPdfSignedUrl);
  const regenerate = useServerFn(regenerateAuthorizationPdf);

  async function openPdf(id: string, mode: "view" | "download" | "print") {
    try {
      const res = await getSignedUrl({ data: { authorizationId: id } });
      if (!res.ok) {
        toast.error("Não foi possível acessar o arquivo.");
        return;
      }
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = res.signedUrl;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const win = window.open(res.signedUrl, "_blank", "noopener,noreferrer");
        if (mode === "print" && win) {
          setTimeout(() => { try { win.print(); } catch { /* ignore */ } }, 800);
        }
      }
    } catch {
      toast.error("Não foi possível acessar o arquivo.");
    }
  }

  const regenerating = useMutation({
    mutationFn: async (id: string) => {
      const res = await regenerate({ data: { authorizationId: id } });
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onSuccess: () => {
      toast.success("PDF gerado com sucesso.");
      qc.invalidateQueries({ queryKey: ["admin-authorizations"] });
    },
    onError: () => toast.error("Não foi possível gerar o documento."),
  });

  return (
    <AdminLayout title="Autorizações">
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Pesquisar</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <div className="grid gap-1.5">
            <Label>Protocolo, comprador, pessoa autorizada, pedido ou vendedor</Label>
            <Input placeholder="Digite para pesquisar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusValue)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="awaiting_pickup">Aguardando</SelectItem>
                <SelectItem value="picked_up">Retirada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Pessoa autorizada</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>PDF</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading && (
                <TableRow><TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell></TableRow>
              )}
              {query.isSuccess && filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="py-10 text-center text-muted-foreground">
                  Nenhuma autorização encontrada.
                </TableCell></TableRow>
              )}
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.protocol}</TableCell>
                  <TableCell className="text-xs">{formatDate(r.submitted_at)}</TableCell>
                  <TableCell>{r.buyer_name}</TableCell>
                  <TableCell className="font-mono text-xs">{maskCPFDisplay(r.buyer_cpf)}</TableCell>
                  <TableCell>{r.authorized_person_name}</TableCell>
                  <TableCell className="font-mono text-xs">{maskCPFDisplay(r.authorized_person_cpf)}</TableCell>
                  <TableCell>{r.order_number}</TableCell>
                  <TableCell>{r.sellers?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge></TableCell>
                  <TableCell><PdfBadge status={r.pdf_generation_status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setViewing(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {r.pdf_generation_status === "generated" && (
                        <Button variant="ghost" size="icon" title="Abrir PDF" onClick={() => openPdf(r.id, "view")}>
                          <FileText className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      {r.status === "awaiting_pickup" && (
                        <>
                          <Button variant="ghost" size="icon" title="Marcar como retirada"
                            onClick={() => updateStatus.mutate({ id: r.id, to: "picked_up" })}>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Cancelar"
                            onClick={() => updateStatus.mutate({ id: r.id, to: "cancelled" })}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="sm:max-w-lg">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono">{viewing.protocol}</DialogTitle>
                <DialogDescription>Detalhes da autorização</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 text-sm">
                <Info label="Data" value={formatDate(viewing.submitted_at)} />
                <Info label="Status" value={STATUS_LABEL[viewing.status] ?? viewing.status} />
                <Info label="Vendedor" value={viewing.sellers?.name ?? "—"} />
                <hr />
                <Info label="Comprador" value={viewing.buyer_name} />
                <Info label="CPF" value={maskCPFDisplay(viewing.buyer_cpf)} />
                <Info label="Telefone" value={viewing.buyer_phone} />
                <Info label="Pedido" value={viewing.order_number} />
                <hr />
                <Info label="Pessoa autorizada" value={viewing.authorized_person_name} />
                <Info label="CPF" value={maskCPFDisplay(viewing.authorized_person_cpf)} />
                <hr />
                <div>
                  <div className="text-xs uppercase text-muted-foreground">Produtos</div>
                  <div className="mt-1 whitespace-pre-line rounded-md border bg-muted/40 p-2">{viewing.products_description}</div>
                </div>
                {viewing.customer_notes && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground">Observações</div>
                    <div className="mt-1 whitespace-pre-line rounded-md border bg-muted/40 p-2">{viewing.customer_notes}</div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {viewing.pdf_generation_status === "generated" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openPdf(viewing.id, "view")}>
                      <FileText className="mr-2 h-4 w-4" /> Visualizar PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openPdf(viewing.id, "download")}>
                      <Download className="mr-2 h-4 w-4" /> Baixar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openPdf(viewing.id, "print")}>
                      Imprimir
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    {viewing.pdf_generation_status === "failed" ? "Falha ao gerar o PDF." : "PDF ainda não gerado."}
                  </div>
                )}
                <Button variant="secondary" size="sm"
                  onClick={() => regenerating.mutate(viewing.id)}
                  disabled={regenerating.isPending}>
                  {regenerating.isPending
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <RefreshCw className="mr-2 h-4 w-4" />}
                  Gerar PDF novamente
                </Button>
              </div>
              {viewing.status === "awaiting_pickup" && (
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => updateStatus.mutate({ id: viewing.id, to: "cancelled" })}>
                    <XCircle className="mr-2 h-4 w-4" /> Cancelar autorização
                  </Button>
                  <Button onClick={() => updateStatus.mutate({ id: viewing.id, to: "picked_up" })}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como retirada
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
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
