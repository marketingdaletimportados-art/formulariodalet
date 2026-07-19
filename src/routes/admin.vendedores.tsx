import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Power, Copy } from "lucide-react";

export const Route = createFileRoute("/admin/vendedores")({
  head: () => ({ meta: [{ title: "Vendedores — Dalet Importados" }] }),
  component: VendedoresPage,
});

const vendedores = [
  { nome: "Carlos Menezes", setor: "Vendas", whatsapp: "(11) 98888-1111", link: "dalet.app/v/carlos", ativo: true, count: 42 },
  { nome: "Renata Alves", setor: "Vendas", whatsapp: "(11) 98888-2222", link: "dalet.app/v/renata", ativo: true, count: 37 },
  { nome: "Bruno Costa", setor: "Atacado", whatsapp: "(11) 98888-3333", link: "dalet.app/v/bruno", ativo: false, count: 12 },
];

function VendedoresPage() {
  return (
    <AdminLayout title="Vendedores">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar vendedor..." className="pl-9" />
        </div>
        <Button size="lg" className="h-12">
          <Plus className="mr-2 h-4 w-4" /> Novo vendedor
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Link exclusivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Autorizações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendedores.map((v) => (
                <TableRow key={v.nome}>
                  <TableCell className="font-medium">{v.nome}</TableCell>
                  <TableCell>{v.setor}</TableCell>
                  <TableCell>{v.whatsapp}</TableCell>
                  <TableCell className="font-mono text-xs">{v.link}</TableCell>
                  <TableCell>
                    <Badge variant={v.ativo ? "default" : "secondary"}>
                      {v.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{v.count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Copiar link"><Copy className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Ativar/Desativar"><Power className="h-4 w-4" /></Button>
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
