import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  listOnboardingEmployees, listOnboardingTasks, updateOnboardingTask,
  addOnboardingTask, deleteOnboardingTask,
  ONBOARDING_CATEGORIES, type OnboardingCategory, type OnboardingStatus,
} from "@/lib/onboarding.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck, FileText, GraduationCap, Users as UsersIcon, Plus, Trash2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/talent/onboarding")({
  component: OnboardingPage,
});

const CATEGORY_META: Record<OnboardingCategory, { label: string; icon: typeof FileText; color: string }> = {
  document: { label: "Documentos", icon: FileText, color: "text-blue-500" },
  integration: { label: "Integração", icon: UsersIcon, color: "text-emerald-500" },
  training: { label: "Treinamentos", icon: GraduationCap, color: "text-violet-500" },
};

const STATUS_LABEL: Record<OnboardingStatus, string> = {
  pending: "Pendente", in_progress: "Em andamento", done: "Concluído", skipped: "N/A",
};

function OnboardingPage() {
  const list = useServerFn(listOnboardingEmployees);
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["onboarding-employees"],
    queryFn: () => list(),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const selectedEmp = useMemo(() => employees.find((e) => e.employee_id === selected) ?? employees[0] ?? null, [employees, selected]);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="h-4 w-4" /> Colaboradores admitidos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-3">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && employees.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum onboarding ativo. Admita um candidato em uma vaga para iniciar o processo.
            </p>
          )}
          {employees.map((e) => {
            const active = (selectedEmp?.employee_id ?? null) === e.employee_id;
            return (
              <button
                key={e.employee_id}
                onClick={() => setSelected(e.employee_id)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{e.full_name}</p>
                  <Badge variant={e.progress === 100 ? "default" : "secondary"}>{e.progress}%</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {[e.role_title, e.department_name].filter(Boolean).join(" • ") || "—"}
                </p>
                <Progress value={e.progress} className="mt-2 h-1.5" />
                <p className="mt-1 text-xs text-muted-foreground">{e.done}/{e.total} tarefas</p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {selectedEmp ? (
        <EmployeeChecklist employeeId={selectedEmp.employee_id} name={selectedEmp.full_name} />
      ) : (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Selecione um colaborador.</CardContent></Card>
      )}
    </div>
  );
}

function EmployeeChecklist({ employeeId, name }: { employeeId: string; name: string }) {
  const qc = useQueryClient();
  const fetchTasks = useServerFn(listOnboardingTasks);
  const update = useServerFn(updateOnboardingTask);
  const add = useServerFn(addOnboardingTask);
  const remove = useServerFn(deleteOnboardingTask);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["onboarding-tasks", employeeId],
    queryFn: () => fetchTasks({ data: { employee_id: employeeId } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["onboarding-tasks", employeeId] });
    qc.invalidateQueries({ queryKey: ["onboarding-employees"] });
  };

  const toggle = useMutation({
    mutationFn: (vars: { id: string; status: OnboardingStatus }) => update({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });

  const create = useMutation({
    mutationFn: (vars: { category: OnboardingCategory; title: string }) =>
      add({ data: { employee_id: employeeId, ...vars } }),
    onSuccess: () => { invalidate(); toast.success("Tarefa adicionada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<OnboardingCategory>("document");

  const grouped = useMemo(() => {
    const g: Record<OnboardingCategory, typeof tasks> = { document: [], integration: [], training: [] };
    for (const t of tasks) g[t.category as OnboardingCategory].push(t);
    return g;
  }, [tasks]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row">
          <Select value={newCategory} onValueChange={(v) => setNewCategory(v as OnboardingCategory)}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ONBOARDING_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_META[c].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Nova tarefa..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                create.mutate({ category: newCategory, title: newTitle.trim() });
                setNewTitle("");
              }
            }}
          />
          <Button
            onClick={() => {
              if (!newTitle.trim()) return;
              create.mutate({ category: newCategory, title: newTitle.trim() });
              setNewTitle("");
            }}
            disabled={create.isPending}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </Button>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando tarefas…</p>}

      {ONBOARDING_CATEGORIES.map((cat) => {
        const meta = CATEGORY_META[cat];
        const items = grouped[cat];
        const Icon = meta.icon;
        return (
          <Card key={cat}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon className={`h-4 w-4 ${meta.color}`} /> {meta.label}
                <Badge variant="outline" className="ml-auto">
                  {items.filter((i) => i.status === "done").length}/{items.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 p-3">
              {items.length === 0 && <p className="text-xs text-muted-foreground">Sem itens.</p>}
              {items.map((t) => {
                const done = t.status === "done";
                return (
                  <div key={t.id} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/40">
                    <Checkbox
                      checked={done}
                      onCheckedChange={(c) => toggle.mutate({ id: t.id, status: c ? "done" : "pending" })}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${done ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                    <Badge variant="secondary" className="text-xs">{STATUS_LABEL[t.status as OnboardingStatus]}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => del.mutate(t.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
