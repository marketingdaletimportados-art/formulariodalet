import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, FileDown, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/admin/autorizacoes")({
  head: () => ({ meta: [{ title: "Autorizações — Dalet Importados" }] }),
  component: AutorizacoesPage,
});

const rows = [
  { protocolo: "AUT-000128", cliente: "João da Silva", pessoa: "Maria Souza", pedido: "12345", vendedor: "Carlos", data: "19/07/2026", status: "Aguardando" },
  { protocolo: "AUT-000127", cliente: "Ana Lima", pessoa: "Pedro Alves", pedido: "12344", vendedor: "Renata", data: "18/07/2026", status: "Retirada" },
  { protocolo: "AUT-000126", cliente: "Roberto Dias", pessoa: "Lucas Dias", pedido: "12343", vendedor: "Carlos", data: "18/07/2026", status: "Cancelada" },
  { protocolo: "AUT-000125", cliente: "Fernanda Melo", pessoa: "Julia Melo", pedido: "12342", vendedor: "Renata", data: "17/07/2026", status: "Aguardando" },
];

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "Retirada") return "default";
  if (status === "Cancelada") return "destructive";
  return "secondary";
}

function AutorizacoesPage() {
  return (
    <AdminLayout title="Autorizações">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5"><Label>Protocolo</Label><Input placeholder="AUT-..." /></div>
          <div className="grid gap-1.5"><Label>Cliente</Label><Input placeholder="Nome do cliente" /></div>
          <div className="grid gap-1.5"><Label>Pessoa autorizada</Label><Input placeholder="Nome" /></div>
          <div className="grid gap-1.5"><Label>Pedido</Label><Input placeholder="Nº do pedido" /></div>
          <div className="grid gap-1.5">
            <Label>Vendedor</Label>
            <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="carlos">Carlos</SelectItem>
                <SelectItem value="renata">Renata</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="aguardando">Aguardando</SelectItem>
                <SelectItem value="retirada">Retirada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5"><Label>Data inicial</Label><Input type="date" /></div>
          <div className="grid gap-1.5"><Label>Data final</Label><Input type="date" /></div>
          <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
            <Button variant="outline">Limpar</Button>
            <Button>Aplicar filtros</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
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
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Visualizar"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Abrir PDF"><FileDown className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Marcar como retirado"><CheckCircle2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Cancelar"><XCircle className="h-4 w-4" /></Button>
                    </div>
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
