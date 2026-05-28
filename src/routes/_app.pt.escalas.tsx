import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ptListSchedules, ptUpsertSchedule } from "@/lib/pt.functions";
import { usePtCompany } from "@/lib/pt-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/pt/escalas")({
  component: SchedulesPage,
});

const DAYS = [
  { k: "1", label: "Seg" }, { k: "2", label: "Ter" }, { k: "3", label: "Qua" },
  { k: "4", label: "Qui" }, { k: "5", label: "Sex" }, { k: "6", label: "Sáb" }, { k: "0", label: "Dom" },
];

function SchedulesPage() {
  const { current } = usePtCompany();
  const qc = useQueryClient();
  const fn = useServerFn(ptListSchedules);
  const q = useQuery({
    queryKey: ["pt", "schedules", current?.id],
    queryFn: () => fn({ data: { company_id: current!.id } }),
    enabled: !!current,
  });

  if (!current) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Escalas</CardTitle>
        <ScheduleDialog onSaved={() => qc.invalidateQueries({ queryKey: ["pt", "schedules"] })} />
      </CardHeader>
      <CardContent>
        {q.isLoading ? <div>Carregando...</div> : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Tolerância</TableHead><TableHead>Dias ativos</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.kind}</TableCell>
                  <TableCell>{s.tolerance_min}min</TableCell>
                  <TableCell>{DAYS.filter((d) => s.weekly_pattern?.[d.k]).map((d) => d.label).join(", ") || "—"}</TableCell>
                  <TableCell><ScheduleDialog schedule={s} onSaved={() => qc.invalidateQueries({ queryKey: ["pt", "schedules"] })} /></TableCell>
                </TableRow>
              ))}
              {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma escala.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleDialog({ schedule, onSaved }: { schedule?: any; onSaved: () => void }) {
  const { current } = usePtCompany();
  const [open, setOpen] = useState(false);
  const init = schedule?.weekly_pattern ?? {};
  const [form, setForm] = useState(() => ({
    name: schedule?.name ?? "",
    kind: schedule?.kind ?? "fixa",
    tolerance_min: schedule?.tolerance_min?.toString() ?? "10",
    intrajornada_min: schedule?.intrajornada_min?.toString() ?? "60",
    interjornada_min: schedule?.interjornada_min?.toString() ?? "660",
    night_shift_start: schedule?.night_shift_start ?? "22:00",
    night_shift_end: schedule?.night_shift_end ?? "05:00",
    pattern: DAYS.reduce((acc, d) => {
      const v = init[d.k];
      acc[d.k] = {
        active: !!v,
        start: v?.start?.slice(0, 5) ?? "08:00",
        end: v?.end?.slice(0, 5) ?? "17:00",
        break_min: (v?.break_min ?? 60).toString(),
      };
      return acc;
    }, {} as Record<string, { active: boolean; start: string; end: string; break_min: string }>),
  }));
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(ptUpsertSchedule);

  const submit = async () => {
    setLoading(true);
    try {
      const weekly_pattern: Record<string, any> = {};
      for (const d of DAYS) {
        const p = form.pattern[d.k];
        weekly_pattern[d.k] = p.active ? { start: p.start, end: p.end, break_min: Number(p.break_min) } : null;
      }
      await fn({
        data: {
          id: schedule?.id,
          company_id: current!.id,
          name: form.name,
          kind: form.kind as any,
          weekly_pattern,
          tolerance_min: Number(form.tolerance_min),
          intrajornada_min: Number(form.intrajornada_min),
          interjornada_min: Number(form.interjornada_min),
          night_shift_start: form.night_shift_start,
          night_shift_end: form.night_shift_end,
        },
      });
      toast.success("Salvo");
      setOpen(false); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {schedule ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button> : <Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova escala</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{schedule ? "Editar" : "Nova"} escala</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["fixa", "5x2", "6x1", "12x36", "flex"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>Tolerância (min)</Label><Input type="number" value={form.tolerance_min} onChange={(e) => setForm({ ...form, tolerance_min: e.target.value })} /></div>
            <div><Label>Intra (min)</Label><Input type="number" value={form.intrajornada_min} onChange={(e) => setForm({ ...form, intrajornada_min: e.target.value })} /></div>
            <div><Label>Inter (min)</Label><Input type="number" value={form.interjornada_min} onChange={(e) => setForm({ ...form, interjornada_min: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Início noturno</Label><Input type="time" value={form.night_shift_start} onChange={(e) => setForm({ ...form, night_shift_start: e.target.value })} /></div>
            <div><Label>Fim noturno</Label><Input type="time" value={form.night_shift_end} onChange={(e) => setForm({ ...form, night_shift_end: e.target.value })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Padrão semanal</Label>
            {DAYS.map((d) => {
              const p = form.pattern[d.k];
              return (
                <div key={d.k} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={p.active} onCheckedChange={(v) => setForm({ ...form, pattern: { ...form.pattern, [d.k]: { ...p, active: !!v } } })} />
                  <span className="w-10">{d.label}</span>
                  <Input type="time" value={p.start} disabled={!p.active} onChange={(e) => setForm({ ...form, pattern: { ...form.pattern, [d.k]: { ...p, start: e.target.value } } })} className="w-28" />
                  <span>—</span>
                  <Input type="time" value={p.end} disabled={!p.active} onChange={(e) => setForm({ ...form, pattern: { ...form.pattern, [d.k]: { ...p, end: e.target.value } } })} className="w-28" />
                  <Input type="number" value={p.break_min} disabled={!p.active} onChange={(e) => setForm({ ...form, pattern: { ...form.pattern, [d.k]: { ...p, break_min: e.target.value } } })} className="w-20" placeholder="intervalo" />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !form.name}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
