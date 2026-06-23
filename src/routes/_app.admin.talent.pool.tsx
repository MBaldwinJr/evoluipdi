import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/page-header";
import { TalentFormDialog } from "@/components/talent/talent-form-dialog";
import {
  TALENT_STATUS_LABEL, type TalentInput, type TalentStatus,
} from "@/lib/talent-pool.types";
import { deleteTalent } from "@/lib/talent-pool.functions";

export const Route = createFileRoute("/_app/admin/talent/pool")({ component: TalentPoolPage });

function TalentPoolPage() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TalentInput | null>(null);
  const del = useServerFn(deleteTalent);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: talents = [], isLoading } = useQuery({
    queryKey: ["talent-pool-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("talent_pool")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return talents.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (q) {
        const hay = `${t.full_name} ${t.email ?? ""} ${t.current_position ?? ""} ${(t.skills as string[] ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [talents, search, statusFilter]);

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH e administradores." />;

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: typeof talents[number]) => {
    setEditing({
      id: t.id, full_name: t.full_name, email: t.email, phone: t.phone,
      location: t.location, linkedin_url: t.linkedin_url,
      current_position: t.current_position, current_company: t.current_company,
      years_experience: t.years_experience ?? 0,
      skills: (t.skills as string[]) ?? [], tags: (t.tags as string[]) ?? [],
      summary: t.summary, source: t.source, status: t.status,
    });
    setDialogOpen(true);
  };

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este candidato?")) return;
    setDeletingId(id);
    try { await del({ data: { id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["talent-pool-list"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar por nome, e-mail, skill…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(TALENT_STATUS_LABEL) as TalentStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{TALENT_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" />Novo candidato</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Banco de talentos vazio" description="Cadastre candidatos para reutilizar em todas as vagas." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cargo atual</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.full_name}</div>
                      <div className="text-xs text-muted-foreground">{t.email ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.current_position ?? "—"}
                      {t.current_company && <div className="text-xs text-muted-foreground">{t.current_company}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {((t.skills as string[]) ?? []).slice(0, 4).map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px] font-normal">{s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TALENT_STATUS_LABEL[t.status as TalentStatus]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" disabled={deletingId === t.id} onClick={() => onDelete(t.id)}>
                        {deletingId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TalentFormDialog
        key={editing?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        initial={editing}
        onSaved={() => { setDialogOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["talent-pool-list"] }); }}
      />
    </div>
  );
}
