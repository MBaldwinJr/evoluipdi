import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Sparkles, Kanban } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/page-header";
import { JobStatusBadge } from "@/components/talent/job-status-badge";
import { TagListEditor } from "@/components/talent/tag-list-editor";
import {
  jobSchema, JOB_STATUS_LABEL, WORK_MODEL_LABEL, EMPLOYMENT_TYPE_LABEL,
  type JobInput, type JobStatus, type WorkModel, type EmploymentType,
} from "@/lib/talent.types";
import { upsertJob, deleteJob, generateJobDescription } from "@/lib/talent.functions";

export const Route = createFileRoute("/_app/admin/talent/jobs")({ component: JobsPage });

type JobRow = {
  id: string; code: string | null; title: string; status: JobStatus;
  vacancies_quantity: number; closing_date: string | null;
  department: { id: string; name: string } | null;
  role: { id: string; title: string } | null;
};

const emptyJob: JobInput = {
  title: "", work_model: "presencial", employment_type: "clt",
  vacancies_quantity: 1, benefits: [], status: "draft",
};

function JobsPage() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JobInput | null>(null);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["talent-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*, department:departments(id,name), role:roles_catalog(id,title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as (JobRow & JobInput)[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (q && !`${j.title} ${j.code ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jobs, statusFilter, search]);

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH e administradores podem gerenciar vagas." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="Buscar por título ou código…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{JOB_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditing(emptyJob)}><Plus className="mr-1 h-4 w-4" />Nova vaga</Button>
            </DialogTrigger>
            <JobFormDialog
              key={editing?.id ?? "new"}
              initial={editing ?? emptyJob}
              onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["talent-jobs"] }); }}
            />
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Nenhuma vaga" description="Crie a primeira vaga clicando em Nova vaga." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Departamento</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Encerramento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs text-muted-foreground">{j.code ?? "—"}</TableCell>
                    <TableCell className="font-medium">{j.title}</TableCell>
                    <TableCell>{j.department?.name ?? "—"}</TableCell>
                    <TableCell>{j.vacancies_quantity}</TableCell>
                    <TableCell className="text-sm">{j.closing_date ?? "—"}</TableCell>
                    <TableCell><JobStatusBadge status={j.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing({ ...j, role_id: j.role?.id ?? null, department_id: j.department?.id ?? null }); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteJobButton id={j.id} onDone={() => qc.invalidateQueries({ queryKey: ["talent-jobs"] })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DeleteJobButton({ id, onDone }: { id: string; onDone: () => void }) {
  const del = useServerFn(deleteJob);
  const [loading, setLoading] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={loading}
      onClick={async () => {
        if (!confirm("Excluir esta vaga?")) return;
        setLoading(true);
        try { await del({ data: { id } }); toast.success("Vaga excluída"); onDone(); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
        finally { setLoading(false); }
      }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  );
}

function JobFormDialog({ initial, onSaved }: { initial: JobInput; onSaved: () => void }) {
  const [form, setForm] = useState<JobInput>(initial);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const save = useServerFn(upsertJob);
  const aiGen = useServerFn(generateJobDescription);

  const { data: depts = [] } = useQuery({
    queryKey: ["talent-depts"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["talent-roles"],
    queryFn: async () => (await supabase.from("roles_catalog").select("id,title,department_id").order("title")).data ?? [],
  });

  const setField = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const fillFromKpis = async () => {
    if (!form.role_id) { toast.error("Selecione um cargo primeiro"); return; }
    const { data: k } = await supabase.from("position_kpis").select("*").eq("role_id", form.role_id).maybeSingle();
    if (!k) { toast.error("Este cargo ainda não possui KPIs cadastrados"); return; }
    setForm((f) => ({
      ...f,
      requirements: [
        k.education_required && `Formação: ${k.education_required}`,
        k.experience_years && `Experiência mínima: ${k.experience_years} ano(s)`,
        Array.isArray(k.mandatory_certifications) && k.mandatory_certifications.length && `Certificações: ${(k.mandatory_certifications as string[]).join(", ")}`,
        Array.isArray(k.mandatory_courses) && k.mandatory_courses.length && `Cursos: ${(k.mandatory_courses as string[]).join(", ")}`,
        Array.isArray(k.required_skills) && k.required_skills.length && `Competências: ${(k.required_skills as string[]).join(", ")}`,
        k.driver_license && `CNH: ${k.driver_license}`,
      ].filter(Boolean).join("\n"),
      benefits: Array.isArray(k.benefits) ? (k.benefits as string[]) : f.benefits,
      salary_min: k.salary_reference ?? f.salary_min,
    }));
    toast.success("Campos preenchidos a partir dos KPIs do cargo");
  };

  const generateWithAI = async () => {
    if (!form.title) { toast.error("Informe o título da vaga"); return; }
    setAiLoading(true);
    try {
      const dept = depts.find((d) => d.id === form.department_id)?.name ?? null;
      const r = await aiGen({ data: {
        title: form.title, role_id: form.role_id ?? null, department_name: dept,
        work_model: form.work_model, employment_type: form.employment_type,
        location: form.location ?? null,
        salary_min: form.salary_min ?? null, salary_max: form.salary_max ?? null,
      }});
      setForm((f) => ({
        ...f,
        responsibilities: r.responsibilities,
        requirements: r.requirements,
        description: r.description,
      }));
      toast.success("Descrição gerada com IA");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao gerar"); }
    finally { setAiLoading(false); }
  };

  const submit = async () => {
    const parsed = jobSchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setSaving(true);
    try { await save({ data: parsed.data }); toast.success("Vaga salva"); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{form.id ? "Editar vaga" : "Nova vaga"}</DialogTitle></DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 grid gap-2">
          <Label>Título *</Label>
          <Input value={form.title} onChange={(e) => setField("title", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Código interno</Label>
          <Input value={form.code ?? ""} onChange={(e) => setField("code", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Cargo (RCF)</Label>
          <Select value={form.role_id ?? "none"} onValueChange={(v) => setField("role_id", v === "none" ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
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
        <div className="grid gap-2">
          <Label>Quantidade</Label>
          <Input type="number" min={1} value={form.vacancies_quantity} onChange={(e) => setField("vacancies_quantity", Number(e.target.value))} />
        </div>
        <div className="grid gap-2">
          <Label>Modelo de trabalho</Label>
          <Select value={form.work_model} onValueChange={(v) => setField("work_model", v as WorkModel)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(WORK_MODEL_LABEL) as WorkModel[]).map((w) => (
                <SelectItem key={w} value={w}>{WORK_MODEL_LABEL[w]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Tipo de contratação</Label>
          <Select value={form.employment_type} onValueChange={(v) => setField("employment_type", v as EmploymentType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(EMPLOYMENT_TYPE_LABEL) as EmploymentType[]).map((t) => (
                <SelectItem key={t} value={t}>{EMPLOYMENT_TYPE_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Localização</Label>
          <Input value={form.location ?? ""} onChange={(e) => setField("location", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Salário mín (R$)</Label>
          <Input type="number" value={form.salary_min ?? ""} onChange={(e) => setField("salary_min", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="grid gap-2">
          <Label>Salário máx (R$)</Label>
          <Input type="number" value={form.salary_max ?? ""} onChange={(e) => setField("salary_max", e.target.value ? Number(e.target.value) : null)} />
        </div>
        <div className="grid gap-2">
          <Label>Encerramento</Label>
          <Input type="date" value={form.closing_date ?? ""} onChange={(e) => setField("closing_date", e.target.value || null)} />
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setField("status", v as JobStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(JOB_STATUS_LABEL) as JobStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{JOB_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2 grid gap-2">
          <Label>Benefícios</Label>
          <TagListEditor value={form.benefits ?? []} onChange={(v) => setField("benefits", v)} placeholder="Adicione benefício e Enter" />
        </div>

        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={fillFromKpis} disabled={!form.role_id}>
            Preencher utilizando KPIs do cargo
          </Button>
          <Button type="button" variant="outline" onClick={generateWithAI} disabled={aiLoading}>
            {aiLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Gerar descrição com IA
          </Button>
        </div>

        <div className="md:col-span-2 grid gap-2">
          <Label>Responsabilidades</Label>
          <Textarea rows={4} value={form.responsibilities ?? ""} onChange={(e) => setField("responsibilities", e.target.value)} />
        </div>
        <div className="md:col-span-2 grid gap-2">
          <Label>Requisitos</Label>
          <Textarea rows={4} value={form.requirements ?? ""} onChange={(e) => setField("requirements", e.target.value)} />
        </div>
        <div className="md:col-span-2 grid gap-2">
          <Label>Descrição completa</Label>
          <Textarea rows={8} value={form.description ?? ""} onChange={(e) => setField("description", e.target.value)} />
        </div>
      </div>

      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
