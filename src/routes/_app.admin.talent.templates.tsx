import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/page-header";
import { jobTemplateSchema, type JobTemplateInput } from "@/lib/talent.types";
import { upsertJobTemplate, deleteJobTemplate, suggestJobTemplate } from "@/lib/talent.functions";

export const Route = createFileRoute("/_app/admin/talent/templates")({ component: TemplatesPage });

const emptyT: JobTemplateInput = { name: "" };

function TemplatesPage() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobTemplateInput | null>(null);
  const del = useServerFn(deleteJobTemplate);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["job-templates"],
    queryFn: async () => (await supabase.from("job_templates").select("*, department:departments(id,name)").order("created_at", { ascending: false })).data ?? [],
  });

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH." />;

  const onDelete = async (id: string) => {
    if (!confirm("Excluir este template?")) return;
    try { await del({ data: { id } }); toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["job-templates"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(emptyT)}><Plus className="mr-1 h-4 w-4" />Novo template</Button>
          </DialogTrigger>
          <TemplateDialog initial={editing ?? emptyT} onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["job-templates"] }); }} />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <EmptyState title="Nenhum template" description="Crie modelos reutilizáveis de descrição, requisitos e responsabilidades." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{t.name}</h3>
                    {t.department?.name && <p className="text-xs text-muted-foreground">{t.department.name}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing({ ...t, department_id: t.department?.id ?? null }); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => onDelete(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                {t.description_template && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description_template}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateDialog({ initial, onSaved }: { initial: JobTemplateInput; onSaved: () => void }) {
  const [form, setForm] = useState<JobTemplateInput>(initial);
  const [saving, setSaving] = useState(false);
  const save = useServerFn(upsertJobTemplate);
  const { data: depts = [] } = useQuery({
    queryKey: ["talent-depts"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });
  const setField = <K extends keyof JobTemplateInput>(k: K, v: JobTemplateInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const parsed = jobTemplateSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Inválido"); return; }
    setSaving(true);
    try { await save({ data: parsed.data }); toast.success("Template salvo"); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{form.id ? "Editar template" : "Novo template"}</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} /></div>
        <div className="grid gap-2">
          <Label>Departamento</Label>
          <Select value={form.department_id ?? "none"} onValueChange={(v) => setField("department_id", v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {depts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2"><Label>Descrição</Label><Textarea rows={5} value={form.description_template ?? ""} onChange={(e) => setField("description_template", e.target.value)} /></div>
        <div className="grid gap-2"><Label>Requisitos</Label><Textarea rows={4} value={form.requirements_template ?? ""} onChange={(e) => setField("requirements_template", e.target.value)} /></div>
        <div className="grid gap-2"><Label>Responsabilidades</Label><Textarea rows={4} value={form.responsibilities_template ?? ""} onChange={(e) => setField("responsibilities_template", e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}
