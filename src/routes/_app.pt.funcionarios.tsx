import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ptListEmployees, ptUpsertEmployee, ptListBranches, ptListSchedules } from "@/lib/pt.functions";
import { usePtCompany } from "@/lib/pt-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/pt/funcionarios")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { current } = usePtCompany();
  const qc = useQueryClient();
  const listFn = useServerFn(ptListEmployees);
  const q = useQuery({
    queryKey: ["pt", "employees", current?.id],
    queryFn: () => listFn({ data: { company_id: current!.id } }),
    enabled: !!current,
  });

  if (!current) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Funcionários</CardTitle>
        <EmployeeDialog onSaved={() => qc.invalidateQueries({ queryKey: ["pt", "employees"] })} />
      </CardHeader>
      <CardContent>
        {q.isLoading ? <div>Carregando...</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Cargo</TableHead><TableHead>Filial</TableHead><TableHead>Escala</TableHead><TableHead>Vínculo</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.full_name}</TableCell>
                  <TableCell>{e.role_title || "—"}</TableCell>
                  <TableCell>{e.branch?.name || "—"}</TableCell>
                  <TableCell>{e.schedule?.name || "—"}</TableCell>
                  <TableCell>{e.user_id ? <Badge variant="secondary">vinculado</Badge> : <Badge variant="outline">sem login</Badge>}</TableCell>
                  <TableCell><EmployeeDialog employee={e} onSaved={() => qc.invalidateQueries({ queryKey: ["pt", "employees"] })} /></TableCell>
                </TableRow>
              ))}
              {(q.data ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhum funcionário cadastrado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeDialog({ employee, onSaved }: { employee?: any; onSaved: () => void }) {
  const { current } = usePtCompany();
  const [open, setOpen] = useState(false);
  const branchesFn = useServerFn(ptListBranches);
  const schedulesFn = useServerFn(ptListSchedules);
  const branches = useQuery({ queryKey: ["pt", "branches", current?.id], queryFn: () => branchesFn({ data: { company_id: current!.id } }), enabled: open && !!current });
  const schedules = useQuery({ queryKey: ["pt", "schedules", current?.id], queryFn: () => schedulesFn({ data: { company_id: current!.id } }), enabled: open && !!current });

  const [form, setForm] = useState(() => ({
    full_name: employee?.full_name ?? "",
    cpf: employee?.cpf ?? "",
    registration: employee?.registration ?? "",
    role_title: employee?.role_title ?? "",
    branch_id: employee?.branch_id ?? "",
    schedule_id: employee?.schedule_id ?? "",
    user_id: employee?.user_id ?? "",
    weekly_hours: employee?.weekly_hours?.toString() ?? "44",
    active: employee?.active ?? true,
  }));
  const [loading, setLoading] = useState(false);
  const fn = useServerFn(ptUpsertEmployee);

  const submit = async () => {
    setLoading(true);
    try {
      await fn({
        data: {
          id: employee?.id,
          company_id: current!.id,
          full_name: form.full_name,
          cpf: form.cpf || null,
          registration: form.registration || null,
          role_title: form.role_title || null,
          branch_id: form.branch_id || null,
          schedule_id: form.schedule_id || null,
          user_id: form.user_id || null,
          weekly_hours: Number(form.weekly_hours),
          contract_type: "CLT",
          active: form.active,
        },
      });
      toast.success("Salvo");
      setOpen(false); onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {employee
          ? <Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>
          : <Button size="sm"><Plus className="mr-1 h-4 w-4" />Novo funcionário</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{employee ? "Editar" : "Novo"} funcionário</DialogTitle></DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            <div><Label>Matrícula</Label><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} /></div>
          </div>
          <div><Label>Cargo</Label><Input value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></div>
          <div>
            <Label>Filial</Label>
            <Select value={form.branch_id || "_none"} onValueChange={(v) => setForm({ ...form, branch_id: v === "_none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhuma —</SelectItem>
                {(branches.data ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Escala</Label>
            <Select value={form.schedule_id || "_none"} onValueChange={(v) => setForm({ ...form, schedule_id: v === "_none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhuma —</SelectItem>
                {(schedules.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>UUID do usuário (auth)</Label><Input value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })} placeholder="opcional" /></div>
            <div><Label>Horas semanais</Label><Input type="number" value={form.weekly_hours} onChange={(e) => setForm({ ...form, weekly_hours: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !form.full_name}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
