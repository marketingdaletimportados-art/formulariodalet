import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Pencil, Power, Copy, Check, Loader2, Link as LinkIcon, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { slugify, maskPhone, normalizePhoneE164 } from "@/lib/formatters";

export const Route = createFileRoute("/admin/_auth/vendedores")({
  head: () => ({ meta: [{ title: "Vendedores — Dalet Importados" }] }),
  component: VendedoresPage,
});

type Seller = {
  id: string;
  name: string;
  slug: string;
  phone: string;
  department: string | null;
  active: boolean;
  registration_source?: string | null;
};

function VendedoresPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Seller | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const sellersQuery = useQuery({
    queryKey: ["admin-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("id, name, slug, phone, department, active, registration_source")
        .order("name");
      if (error) throw error;
      return data as Seller[];
    },
  });

  const authCountsQuery = useQuery({
    queryKey: ["admin-seller-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_authorizations")
        .select("seller_id");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data ?? []) map.set(row.seller_id, (map.get(row.seller_id) ?? 0) + 1);
      return map;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (s: Seller) => {
      const { error } = await supabase.from("sellers").update({ active: !s.active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-sellers"] }),
  });

  const filtered = useMemo(() => {
    const list = sellersQuery.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((v) =>
      v.name.toLowerCase().includes(s) ||
      v.slug.toLowerCase().includes(s) ||
      (v.department?.toLowerCase().includes(s) ?? false),
    );
  }, [sellersQuery.data, search]);

  const PUBLIC_DOMAIN = "https://formulariodalet.vercel.app";
  const buildAuthUrl = (slug: string) => `${PUBLIC_DOMAIN}/autorizacao/${slug}`;

  function copyLink(slug: string) {
    navigator.clipboard.writeText(buildAuthUrl(slug)).then(() => {
      setCopiedSlug(slug);
      toast.success("Link copiado com sucesso.");
      setTimeout(() => setCopiedSlug((c) => (c === slug ? null : c)), 1500);
    });
  }

  function copyRegistrationLink() {
    const url = `${PUBLIC_DOMAIN}/cadastro`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link de cadastro copiado.");
    });
  }

  function shareOnWhatsApp(v: Seller) {
    const message = `Olá, ${v.name}! Este é o seu link exclusivo para autorizações de retirada:\n\n${buildAuthUrl(v.slug)}\n\nGuarde este link e envie aos clientes sempre que precisarem autorizar outra pessoa a retirar uma mercadoria.`;
    const phoneDigits = v.phone.replace(/\D/g, "");
    const url = `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }


  return (
    <AdminLayout title="Vendedores">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Pesquisar vendedor..." className="pl-9"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" variant="outline" className="h-12" onClick={copyRegistrationLink}>
            <LinkIcon className="mr-2 h-4 w-4" /> Copiar link de cadastro
          </Button>
          <Button size="lg" className="h-12" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo vendedor
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Link de autorização</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Autorizações</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellersQuery.isLoading && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell></TableRow>
              )}
              {sellersQuery.isSuccess && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum vendedor cadastrado.
                </TableCell></TableRow>
              )}
              {filtered.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{v.name}</span>
                      {v.registration_source === "public_registration" && (
                        <Badge variant="outline" className="w-fit text-[10px] font-normal">Cadastro público</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{v.department ?? "—"}</TableCell>
                  <TableCell>{v.phone}</TableCell>
                  <TableCell className="font-mono text-xs">/autorizacao/{v.slug}</TableCell>
                  <TableCell>
                    <Badge variant={v.active ? "default" : "secondary"}>
                      {v.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{authCountsQuery.data?.get(v.id) ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Copiar link" onClick={() => copyLink(v.slug)}>
                        {copiedSlug === v.slug ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" title="Abrir formulário" asChild>
                        <a href={buildAuthUrl(v.slug)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="ghost" size="icon" title="Compartilhar pelo WhatsApp"
                        onClick={() => shareOnWhatsApp(v)}>
                        <MessageCircle className="h-4 w-4 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(v)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title={v.active ? "Desativar" : "Ativar"}
                        onClick={() => toggleActive.mutate(v)}>
                        <Power className={`h-4 w-4 ${v.active ? "text-emerald-600" : "text-muted-foreground"}`} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SellerFormDialog
        open={creating || !!editing}
        seller={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
      />
    </AdminLayout>
  );
}

function SellerFormDialog({ open, seller, onClose }: {
  open: boolean; seller: Seller | null; onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!seller;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // reset on open
  useMemo(() => {
    if (open) {
      setName(seller?.name ?? "");
      setSlug(seller?.slug ?? "");
      setSlugTouched(!!seller);
      const rawPhone = seller?.phone ?? "";
      const digits = rawPhone.replace(/\D/g, "");
      const local = digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
        ? digits.slice(2)
        : digits;
      setPhone(local ? maskPhone(local) : "");
      setDepartment(seller?.department ?? "");
      setActive(seller?.active ?? true);
      setError(null);
    }
  }, [open, seller]);

  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function save() {
    setError(null);
    const cleanName = name.trim();
    const cleanSlug = slugify(slug);
    const normalizedPhone = normalizePhoneE164(phone);
    if (cleanName.length < 3) return setError("Informe o nome completo do vendedor.");
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(cleanSlug)) {
      return setError("Slug inválido. Use apenas letras minúsculas, números e hífens.");
    }
    if (!normalizedPhone) {
      return setError("Informe um WhatsApp válido (com DDD). Ex: (67) 99955-0851.");
    }

    setSaving(true);
    // check slug uniqueness
    const { data: existing, error: checkErr } = await supabase
      .from("sellers").select("id").eq("slug", cleanSlug).maybeSingle();
    if (checkErr) { setSaving(false); return setError("Erro ao validar slug."); }
    if (existing && existing.id !== seller?.id) {
      setSaving(false);
      return setError("Este slug já está em uso. Escolha outro.");
    }

    const payload = {
      name: cleanName,
      slug: cleanSlug,
      phone: normalizedPhone,
      department: department.trim() || null,
      active,
    };

    const { error: mutErr } = isEdit
      ? await supabase.from("sellers").update(payload).eq("id", seller!.id)
      : await supabase.from("sellers").insert(payload);

    setSaving(false);
    if (mutErr) return setError("Não foi possível salvar. Verifique sua permissão de acesso.");
    toast.success(isEdit ? "Vendedor atualizado" : "Vendedor cadastrado");
    qc.invalidateQueries({ queryKey: ["admin-sellers"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar vendedor" : "Novo vendedor"}</DialogTitle>
          <DialogDescription>
            O slug forma o link exclusivo do vendedor: <span className="font-mono">/autorizacao/&lt;slug&gt;</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="v-nome">Nome <span className="text-destructive">*</span></Label>
            <Input id="v-nome" value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="Ex: Carlos Ferreira" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="v-slug">Slug <span className="text-destructive">*</span></Label>
            <Input id="v-slug" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
              placeholder="carlos-ferreira" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="v-phone">WhatsApp <span className="text-destructive">*</span></Label>
            <Input id="v-phone" inputMode="tel" value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
              placeholder="(00) 00000-0000" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="v-dep">Setor</Label>
            <Input id="v-dep" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ex: Vendas" />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="text-sm">
              <div className="font-medium">Ativo</div>
              <div className="text-xs text-muted-foreground">Somente vendedores ativos aparecem no link público.</div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          {error && <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando</> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
