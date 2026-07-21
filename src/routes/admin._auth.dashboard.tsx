import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Clock, PackageCheck, XCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/_auth/dashboard")({
  head: () => ({ meta: [{ title: "Visão geral — Dalet Importados" }] }),
  component: DashboardPage,
});

type Row = {
  id: string;
  protocol: string;
  buyer_name: string;
  authorized_person_name: string;
  order_number: string;
  status: string;
  submitted_at: string;
  seller_id: string;
  sellers: { name: string } | null;
};

function statusLabel(s: string) {
  if (s === "picked_up") return "Retirada";
  if (s === "cancelled") return "Cancelada";
  return "Aguardando";
}
function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "picked_up") return "default";
  if (s === "cancelled") return "destructive";
  return "secondary";
}

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const [total, awaiting, pickedUp, cancelled, sentToday, recent] = await Promise.all([
        supabase.from("withdrawal_authorizations").select("id", { count: "exact", head: true }),
        supabase.from("withdrawal_authorizations").select("id", { count: "exact", head: true }).eq("status", "awaiting_pickup"),
        supabase.from("withdrawal_authorizations").select("id", { count: "exact", head: true }).eq("status", "picked_up"),
        supabase.from("withdrawal_authorizations").select("id", { count: "exact", head: true }).eq("status", "cancelled"),
        supabase.from("withdrawal_authorizations").select("id", { count: "exact", head: true }).gte("submitted_at", startOfToday.toISOString()),
        supabase
          .from("withdrawal_authorizations")
          .select("id, protocol, buyer_name, authorized_person_name, order_number, status, submitted_at, seller_id, sellers(name)")
          .order("submitted_at", { ascending: false })
          .limit(8),
      ]);

      return {
        total: total.count ?? 0,
        awaiting: awaiting.count ?? 0,
        pickedUp: pickedUp.count ?? 0,
        cancelled: cancelled.count ?? 0,
        sentToday: sentToday.count ?? 0,
        recent: (recent.data ?? []) as unknown as Row[],
      };
    },
  });

  const stats = [
    { label: "Total de autorizações", value: data?.total ?? 0, icon: FileText, color: "text-primary" },
    { label: "Aguardando retirada", value: data?.awaiting ?? 0, icon: Clock, color: "text-amber-500" },
    { label: "Retiradas", value: data?.pickedUp ?? 0, icon: PackageCheck, color: "text-emerald-600" },
    { label: "Canceladas", value: data?.cancelled ?? 0, icon: XCircle, color: "text-destructive" },
    { label: "Enviadas hoje", value: data?.sentToday ?? 0, icon: Send, color: "text-blue-500" },
  ];

  return (
    <AdminLayout title="Visão geral">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? "—" : s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Autorizações recentes</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/autorizacoes">Ver todas</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pessoa autorizada</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
              ) : (data?.recent.length ?? 0) === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma autorização registrada ainda.</TableCell></TableRow>
              ) : (
                data!.recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.protocol}</TableCell>
                    <TableCell>{r.buyer_name}</TableCell>
                    <TableCell>{r.authorized_person_name}</TableCell>
                    <TableCell>{r.order_number}</TableCell>
                    <TableCell>{r.sellers?.name ?? "—"}</TableCell>
                    <TableCell>{new Date(r.submitted_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
