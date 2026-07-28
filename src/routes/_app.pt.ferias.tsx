import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ptListVacations, ptRequestVacation, ptTransitionVacation, ptDeleteVacation,
  ptGetVacationBalance, ptListVacationEmployees,
} from "@/lib/pt-vacations.functions";
import { usePtCompany } from "@/lib/pt-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plane, Plus, Check, X, Trash2, AlertTriangle, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/pt/ferias")({ component: VacationsPage });

const STATUS_META: Record<string, { label: string; className: string }> = {
  solicitada: { label: "Solicitada", className: "bg-amber-500/15 text-amber-700 border-amber-300" },
  aprovada_gestor: { label: "Aprov. gestor", className: "bg-blue-500/15 text-blue-700 border-blue-300" },
  aprovada_rh: { label: "Aprov. RH", className: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  agendada: { label: "Agendada", className: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  em_curso: { label: "Em curso", className: "bg-violet-500/15 text-violet-700 border-violet-300" },
  concluida: { label: "Concluída", className: "bg-slate-500/15 text-slate-700 border-slate-300" },
  rejeitada: { label: "Rejeitada", className: "bg-red-500/15 text-red-700 border-red-300" },
  cancelada: { label: "Cancelada", className: "bg-slate-500/15 text-slate-700 border-slate-300" },
};

const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
}

function VacationsPage() {
  const { current } = usePtCompany();
  const qc = useQueryClient();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [openNew, setOpenNew] = useState(false);

  const listFn = useServerFn(ptListVacations);
  const empsFn = useServerFn(ptListVacationEmployees);
  const transitionFn = useServerFn(ptTransitionVacation);
  const deleteFn = useServerFn(ptDeleteVacation);

  const listQ = useQuery({
    queryKey: ["pt", "vac", current?.id, year, statusFilter],
    queryFn: () => listFn({ data: { company_id: current!.id, year, status: statusFilter === "todos" ? undefined : statusFilter } }),
    enabled: !!current,
  });
  const empsQ = useQuery({
    queryKey: ["pt", "vac", "emps", current?.id],
    queryFn: () => empsFn({ data: { company_id: current!.id } }),
    enabled: !!current,
  });

  const isMgr = current && ["admin", "rh", "gestor"].includes(current.role);
  const isRh = current && ["admin", "rh"].includes(current.role);

  const rows = listQ.data ?? [];

  const kpis = useMemo(() => {
    const list = rows as any[];
    return {
      total: list.length,
      pending: list.filter((r) => ["solicitada", "aprovada_gestor"].includes(r.status)).length,
      inCourse: list.filter((r) => r.status === "em_curso").length,
      overdue: (empsQ.data ?? []).length, // placeholder — real check per employee
    };
  }, [rows, empsQ.data]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["pt", "vac"] });

  const doAction = async (id: string, action: string, reason?: string) => {
    try {
      await transitionFn({ data: { id, action: action as any, reason } });
      toast.success("Atualizado");
      invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!current) return null;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard icon={<CalendarDays className="h-4 w-4" />} label="Total no ano" value={kpis.total} />
        <KpiCard icon={<Plane className="h-4 w-4" />} label="Pendentes de aprovação" value={kpis.pending} />
        <KpiCard icon={<Check className="h-4 w-4" />} label="Em curso" value={kpis.inCourse} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Colaboradores ativos" value={kpis.overdue} />
      </div>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[year - 1, year, year + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {Object.entries(STATUS_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NewVacationDialog
            open={openNew}
            onOpenChange={setOpenNew}
            employees={empsQ.data ?? []}
            companyId={current.id}
            canPickAny={!!isMgr}
            onCreated={invalidate}
          />
        </CardContent>
      </Card>

      <OverlapAlerts rows={rows as any[]} />

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Timeline anual</TabsTrigger>
          <TabsTrigger value="mensal">Timeline mensal</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-3">
          <VacationTimeline rows={rows as any[]} year={year} />
        </TabsContent>

        <TabsContent value="mensal" className="space-y-3">
          <MonthlyTimeline rows={rows as any[]} year={year} />
        </TabsContent>

        <TabsContent value="lista">
          <Card>
            <CardContent className="overflow-x-auto pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Período de gozo</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Abono</TableHead>
                    <TableHead>13º</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada</TableCell></TableRow>
                  )}
                  {(rows as any[]).map((r) => {
                    const meta = STATUS_META[r.status] ?? STATUS_META.solicitada;
                    const overdue = r.concessive_deadline && r.concessive_deadline < new Date().toISOString().slice(0, 10)
                      && !["concluida", "cancelada", "rejeitada"].includes(r.status);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.employee?.full_name ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.department?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(r.start_date)} → {fmtDate(r.end_date)}</TableCell>
                        <TableCell>{r.days_total}</TableCell>
                        <TableCell>{r.abono_days > 0 ? `${r.abono_days}d` : "—"}</TableCell>
                        <TableCell>{r.advance_13 ? "Sim" : "—"}</TableCell>
                        <TableCell className={cn(overdue && "text-destructive font-medium")}>{fmtDate(r.concessive_deadline)}</TableCell>
                        <TableCell><Badge variant="outline" className={meta.className}>{meta.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <VacationActions
                            row={r}
                            isMgr={!!isMgr}
                            isRh={!!isRh}
                            onAction={doAction}
                            onDelete={async () => {
                              if (!confirm("Excluir esta solicitação?")) return;
                              try { await deleteFn({ data: { id: r.id } }); toast.success("Excluída"); invalidate(); }
                              catch (e: any) { toast.error(e.message); }
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

function VacationActions({
  row, isMgr, isRh, onAction, onDelete,
}: { row: any; isMgr: boolean; isRh: boolean; onAction: (id: string, a: string, r?: string) => void; onDelete: () => void }) {
  const s = row.status;
  return (
    <div className="flex justify-end gap-1">
      {isMgr && s === "solicitada" && (
        <Button size="sm" variant="outline" onClick={() => onAction(row.id, "approve_manager")}><Check className="h-3 w-3 mr-1" />Gestor</Button>
      )}
      {isRh && ["solicitada", "aprovada_gestor"].includes(s) && (
        <Button size="sm" onClick={() => onAction(row.id, "approve_rh")}><Check className="h-3 w-3 mr-1" />RH</Button>
      )}
      {isRh && s === "aprovada_rh" && (
        <Button size="sm" variant="outline" onClick={() => onAction(row.id, "start")}>Iniciar</Button>
      )}
      {isRh && s === "em_curso" && (
        <Button size="sm" variant="outline" onClick={() => onAction(row.id, "complete")}>Concluir</Button>
      )}
      {isMgr && ["solicitada", "aprovada_gestor", "aprovada_rh"].includes(s) && (
        <Button size="sm" variant="ghost" onClick={() => {
          const r = prompt("Motivo da rejeição:");
          if (r !== null) onAction(row.id, "reject", r || undefined);
        }}><X className="h-3 w-3" /></Button>
      )}
      {["solicitada", "aprovada_gestor", "aprovada_rh"].includes(s) && (
        <Button size="sm" variant="ghost" onClick={() => onAction(row.id, "cancel")}>Cancelar</Button>
      )}
      {isRh && (
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
      )}
    </div>
  );
}

function VacationTimeline({ rows, year }: { rows: any[]; year: number }) {
  // Group by employee
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: any[] }>();
    for (const r of rows) {
      const id = r.employee?.id ?? r.employee_id;
      const name = r.employee?.full_name ?? "—";
      if (!map.has(id)) map.set(id, { name, items: [] });
      map.get(id)!.items.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows]);

  if (grouped.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma férias registrada em {year}.</CardContent></Card>;
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto pt-6">
        <div className="min-w-[900px]">
          {/* Months header */}
          <div className="grid grid-cols-[220px_repeat(12,1fr)] gap-1 pb-2 text-xs font-medium text-muted-foreground border-b">
            <div>Colaborador</div>
            {MONTHS.map((m) => <div key={m} className="text-center">{m}</div>)}
          </div>
          {grouped.map(([id, { name, items }]) => (
            <div key={id} className="grid grid-cols-[220px_repeat(12,1fr)] gap-1 items-center py-2 border-b">
              <div className="text-sm font-medium truncate pr-2">{name}</div>
              {MONTHS.map((_, mi) => {
                const monthStart = new Date(Date.UTC(year, mi, 1));
                const monthEnd = new Date(Date.UTC(year, mi + 1, 0));
                const segments = items.filter((r) => {
                  const s = new Date(r.start_date + "T00:00:00Z");
                  const e = new Date(r.end_date + "T00:00:00Z");
                  return e >= monthStart && s <= monthEnd;
                });
                return (
                  <div key={mi} className="relative h-6 bg-muted/40 rounded-sm">
                    {segments.map((r) => {
                      const s = new Date(r.start_date + "T00:00:00Z");
                      const e = new Date(r.end_date + "T00:00:00Z");
                      const startDay = Math.max(1, s.getUTCMonth() === mi && s.getUTCFullYear() === year ? s.getUTCDate() : 1);
                      const endDay = Math.min(monthEnd.getUTCDate(), e.getUTCMonth() === mi && e.getUTCFullYear() === year ? e.getUTCDate() : monthEnd.getUTCDate());
                      const days = monthEnd.getUTCDate();
                      const left = ((startDay - 1) / days) * 100;
                      const width = ((endDay - startDay + 1) / days) * 100;
                      const meta = STATUS_META[r.status] ?? STATUS_META.solicitada;
                      return (
                        <div
                          key={r.id}
                          title={`${fmtDate(r.start_date)} → ${fmtDate(r.end_date)} — ${meta.label}`}
                          className={cn("absolute top-0 h-full rounded-sm border", meta.className)}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NewVacationDialog({
  open, onOpenChange, employees, companyId, canPickAny, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  employees: any[]; companyId: string; canPickAny: boolean; onCreated: () => void;
}) {
  const balanceFn = useServerFn(ptGetVacationBalance);
  const requestFn = useServerFn(ptRequestVacation);
  const [employeeId, setEmployeeId] = useState("");
  const [periodIdx, setPeriodIdx] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [abono, setAbono] = useState(0);
  const [advance13, setAdvance13] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const balQ = useQuery({
    queryKey: ["pt", "vac-balance", employeeId],
    queryFn: () => balanceFn({ data: { company_id: companyId, employee_id: employeeId } }),
    enabled: !!employeeId,
  });

  useEffect(() => {
    if (open) { setEmployeeId(""); setPeriodIdx(""); setStartDate(""); setEndDate(""); setAbono(0); setAdvance13(false); setNotes(""); }
  }, [open]);

  const periods = (balQ.data as any)?.periods ?? [];
  const selectedPeriod = periods[Number(periodIdx)];
  const days = startDate && endDate ? daysBetween(startDate, endDate) : 0;

  const submit = async () => {
    if (!employeeId || !startDate || !endDate) {
      toast.error("Preencha colaborador e datas"); return;
    }
    if (days + abono > 30) { toast.error("Gozo + abono deve ser até 30 dias"); return; }
    if (days < 5 && abono === 0) { toast.error("Cada período de gozo deve ter no mínimo 5 dias (CLT)"); return; }
    setSaving(true);
    try {
      await requestFn({ data: {
        company_id: companyId,
        employee_id: employeeId,
        acquisition_start: selectedPeriod?.acquisition_start ?? null,
        acquisition_end: selectedPeriod?.acquisition_end ?? null,
        concessive_deadline: selectedPeriod?.concessive_deadline ?? null,
        start_date: startDate,
        end_date: endDate,
        abono_days: abono,
        advance_13: advance13,
        notes: notes || undefined,
      } });
      toast.success("Solicitação enviada");
      onOpenChange(false);
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-1" />Nova solicitação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Solicitar férias</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Colaborador</Label>
            <Select value={employeeId} onValueChange={setEmployeeId} disabled={!canPickAny && employees.length > 1}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {employees.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name} {e.role_title ? `— ${e.role_title}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {employeeId && periods.length > 0 && (
            <div>
              <Label>Período aquisitivo <span className="text-xs text-muted-foreground">(opcional)</span></Label>
              <Select value={periodIdx} onValueChange={setPeriodIdx}>
                <SelectTrigger><SelectValue placeholder="Não vincular" /></SelectTrigger>
                <SelectContent>
                  {periods.map((p: any, i: number) => (
                    <SelectItem key={i} value={String(i)}>
                      {fmtDate(p.acquisition_start)} a {fmtDate(p.acquisition_end)} • disp {p.days_available}d • vence {fmtDate(p.concessive_deadline)}
                      {p.status === "vencido" ? " ⚠️" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPeriod?.status === "vencido" && (
                <p className="text-xs text-destructive mt-1">Período concessivo vencido — pagamento em dobro (art. 137 CLT)</p>
              )}
            </div>
          )}
          {employeeId && periods.length === 0 && !balQ.isLoading && (
            <p className="text-xs text-muted-foreground">
              Sem data de admissão cadastrada — período aquisitivo será calculado automaticamente a partir do início do gozo.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início do gozo</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>Fim do gozo</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Abono pecuniário (dias, máx 10)</Label>
              <Input type="number" min={0} max={10} value={abono} onChange={(e) => setAbono(Number(e.target.value) || 0)} />
              <p className="text-xs text-muted-foreground mt-1">Venda de 1/3 das férias</p>
            </div>
            <div className="flex flex-col justify-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={advance13} onCheckedChange={(v) => setAdvance13(v === true)} />
                <span className="text-sm">Adiantamento do 13º salário</span>
              </label>
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {days > 0 && (
            <div className="rounded-md border p-3 text-sm bg-muted/40">
              <strong>Resumo:</strong> {days} dias de gozo + {abono} de abono = {days + abono} dias
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>Enviar solicitação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
