import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, Save, Star } from "lucide-react";
import { toast } from "sonner";
import {
  listEmployeesForEvalFn,
  getWeeklyEvalFn,
  saveWeeklyEvalFn,
} from "@/lib/weekly-eval.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/weekly-eval")({ component: WeeklyEvalPage });

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 sun .. 6 sat
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}
function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtWeek(d: Date): string {
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const f = (x: Date) => x.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${f(d)} — ${f(end)}/${end.getFullYear()}`;
}

type ItemState = { score: number; notes: string };

function WeeklyEvalPage() {
  const listEmployees = useServerFn(listEmployeesForEvalFn);
  const getWeekly = useServerFn(getWeeklyEvalFn);
  const save = useServerFn(saveWeeklyEvalFn);

  const [empId, setEmpId] = useState<string>("");
  const [roleOverride, setRoleOverride] = useState<string>(""); // "" = usar cargo do colaborador
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const employeesQ = useQuery({
    queryKey: ["weekly-eval", "employees"],
    queryFn: () => listEmployees(),
  });

  // Ao trocar de colaborador, resetar override para usar o cargo designado
  useEffect(() => {
    setRoleOverride("");
  }, [empId]);

  const weekISO = toISO(weekStart);
  const weeklyQ = useQuery({
    queryKey: ["weekly-eval", "data", empId, weekISO, roleOverride],
    queryFn: () =>
      getWeekly({
        data: {
          employeeId: empId,
          weekStart: weekISO,
          roleIdOverride: roleOverride || null,
        },
      }),
    enabled: !!empId,
  });

  useEffect(() => {
    if (!weeklyQ.data) return;
    const map: Record<string, ItemState> = {};
    for (const p of weeklyQ.data.processes) {
      const existing = weeklyQ.data.evaluations.find((e: any) => e.role_process_id === p.id);
      map[p.id] = { score: existing?.score ?? 0, notes: existing?.notes ?? "" };
    }
    setItems(map);
  }, [weeklyQ.data]);


  const filteredEmployees = useMemo(() => {
    const list = employeesQ.data ?? [];
    if (!search.trim()) return list;
    const s = search.toLowerCase();
    return list.filter((e: any) =>
      e.full_name?.toLowerCase().includes(s) || e.role?.title?.toLowerCase().includes(s),
    );
  }, [employeesQ.data, search]);

  const shiftWeek = (deltaDays: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    setWeekStart(getMonday(d));
  };

  const avg = useMemo(() => {
    const vals = Object.values(items).map((i) => i.score).filter((s) => s > 0);
    if (!vals.length) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [items]);

  const handleSave = async () => {
    const payloadItems = Object.entries(items)
      .filter(([, v]) => v.score > 0)
      .map(([roleProcessId, v]) => ({ roleProcessId, score: v.score, notes: v.notes || null }));
    if (!payloadItems.length) {
      toast.error("Dê pelo menos uma nota antes de salvar.");
      return;
    }
    setSaving(true);
    try {
      await save({ data: { employeeId: empId, weekStart: weekISO, items: payloadItems } });
      toast.success("Avaliação semanal salva.");
      weeklyQ.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const emp = weeklyQ.data?.employee as any;
  const processes = weeklyQ.data?.processes ?? [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <PageHeader
        title="Avaliação Semanal de Desempenho"
        description="Avalie o colaborador em cada processo do cargo, semana a semana."
      />

      <Card className="mb-4">
        <CardContent className="grid gap-4 pt-6 md:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <Label>Colaborador</Label>
            <Input
              placeholder="Buscar por nome ou cargo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2"
            />
            <Select value={empId} onValueChange={setEmpId}>
              <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
              <SelectContent>
                {filteredEmployees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name} {e.role?.title ? `— ${e.role.title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Semana</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => shiftWeek(-7)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-center text-sm font-medium">
                {fmtWeek(weekStart)}
              </div>
              <Button variant="outline" size="icon" onClick={() => shiftWeek(7)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-end">
            <Button variant="secondary" onClick={() => setWeekStart(getMonday(new Date()))}>
              Semana atual
            </Button>
          </div>
        </CardContent>
      </Card>

      {!empId && (
        <EmptyState title="Selecione um colaborador" description="Escolha quem você deseja avaliar nesta semana." />
      )}

      {empId && weeklyQ.isLoading && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando processos do cargo…
        </div>
      )}

      {empId && weeklyQ.data && !emp?.role_id && (
        <EmptyState
          title="Sem cargo definido"
          description="Este colaborador ainda não tem cargo. Defina o cargo em Colaboradores para carregar os processos."
        />
      )}

      {empId && weeklyQ.data && emp?.role_id && processes.length === 0 && (
        <EmptyState
          title="Nenhum processo cadastrado"
          description="O cargo deste colaborador ainda não tem processos. Cadastre em Processos por cargo."
        />
      )}

      {empId && weeklyQ.data && processes.length > 0 && (
        <>
          <Card className="mb-4">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <div>
                <div className="text-sm text-muted-foreground">Cargo</div>
                <div className="font-medium">{emp?.role?.title ?? "—"}</div>
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-muted-foreground">Processos</div>
                  <div className="text-xl font-semibold">{processes.length}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Avaliados</div>
                  <div className="text-xl font-semibold">
                    {Object.values(items).filter((i) => i.score > 0).length}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Média</div>
                  <div className="text-xl font-semibold">{avg ? avg.toFixed(1) : "—"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {processes.map((p: any, idx: number) => {
              const it = items[p.id] ?? { score: 0, notes: "" };
              return (
                <Card key={p.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-start justify-between gap-3 text-base">
                      <span className="flex items-start gap-2">
                        <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                        <span>{p.title}</span>
                      </span>
                      {it.score > 0 && (
                        <Badge variant="secondary" className="shrink-0">Nota {it.score}</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {p.objective && (
                      <p className="text-sm text-muted-foreground">{p.objective}</p>
                    )}
                    <div>
                      <Label className="mb-2 block text-xs uppercase text-muted-foreground">Nota</Label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() =>
                              setItems((s) => ({ ...s, [p.id]: { ...it, score: n } }))
                            }
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-md border transition",
                              it.score >= n
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input bg-background text-muted-foreground hover:bg-accent",
                            )}
                            aria-label={`Nota ${n}`}
                          >
                            <Star className={cn("h-4 w-4", it.score >= n && "fill-current")} />
                          </button>
                        ))}
                        <div className="ml-3 self-center text-xs text-muted-foreground">
                          1 abaixo · 3 esperado · 5 excede
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs uppercase text-muted-foreground">
                        Observações (fato / impacto / próximo passo)
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="O que aconteceu, qual o impacto e qual o próximo passo?"
                        value={it.notes}
                        onChange={(e) =>
                          setItems((s) => ({ ...s, [p.id]: { ...it, notes: e.target.value } }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="sticky bottom-4 mt-6 flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="lg" className="shadow-lg">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar avaliação da semana
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
