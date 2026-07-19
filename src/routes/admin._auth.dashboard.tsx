import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Clock, PackageCheck, XCircle, Send, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/admin/_auth/dashboard")({
  head: () => ({ meta: [{ title: "Visão geral — Dalet Importados" }] }),
  component: DashboardPage,
});

const stats = [
  { label: "Total de autorizações", value: "128", icon: FileText, color: "text-primary" },
  { label: "Aguardando retirada", value: "24", icon: Clock, color: "text-amber-500" },
  { label: "Retiradas", value: "96", icon: PackageCheck, color: "text-emerald-600" },
  { label: "Canceladas", value: "8", icon: XCircle, color: "text-destructive" },
  { label: "Enviadas hoje", value: "5", icon: Send, color: "text-blue-500" },
];

const rows = [
  { protocolo: "AUT-000128", cliente: "João da Silva", pessoa: "Maria Souza", pedido: "12345", vendedor: "Carlos", data: "19/07/2026", status: "Aguardando" },
  { protocolo: "AUT-000127", cliente: "Ana Lima", pessoa: "Pedro Alves", pedido: "12344", vendedor: "Renata", data: "18/07/2026", status: "Retirada" },
  { protocolo: "AUT-000126", cliente: "Roberto Dias", pessoa: "Lucas Dias", pedido: "12343", vendedor: "Carlos", data: "18/07/2026", status: "Cancelada" },
  { protocolo: "AUT-000125", cliente: "Fernanda Melo", pessoa: "Julia Melo", pedido: "12342", vendedor: "Renata", data: "17/07/2026", status: "Aguardando" },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Retirada") return "default";
  if (status === "Cancelada") return "destructive";
  return "secondary";
}

function DashboardPage() {
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
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Autorizações recentes</CardTitle>
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
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.protocolo}>
                  <TableCell className="font-mono text-xs">{r.protocolo}</TableCell>
                  <TableCell>{r.cliente}</TableCell>
                  <TableCell>{r.pessoa}</TableCell>
                  <TableCell>{r.pedido}</TableCell>
                  <TableCell>{r.vendedor}</TableCell>
                  <TableCell>{r.data}</TableCell>
                  <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
