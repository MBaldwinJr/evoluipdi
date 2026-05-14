import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Plus, ListChecks } from "lucide-react";
import { createUserAndEmployee, setEmployeeRole } from "@/lib/admin.functions";

export const Route = createFileRoute("/_app/admin/people")({ component: AdminPeople });

async function getErrorMessage(e: unknown, fallback: string) {
  if (e instanceof Response) return (await e.text()) || fallback;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

async function ensureServerFnOk<T>(result: T, fallback: string) {
  if (result instanceof Response) throw new Error((await result.text()) || fallback);
  return result;
}

function AdminPeople() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: people = [] } = useQuery({
    queryKey: ["admin-people"], enabled: isRH,
    queryFn: async () => (await supabase.from("employees").select("id, user_id, hire_date, profile:profiles!employees_user_id_profiles_fkey(full_name, email), role:roles_catalog(title), department:departments(name)")).data ?? [],
  });
  const { data: roles = [] } = useQuery({ queryKey: ["roles-cat"], queryFn: async () => (await supabase.from("roles_catalog").select("id, title")).data ?? [] });
  const { data: depts = [] } = useQuery({ queryKey: ["depts"], queryFn: async () => (await supabase.from("departments").select("id, name")).data ?? [] });
  const { data: managers = [] } = useQuery({
    queryKey: ["managers-only"],
    queryFn: async () => {
      const { data: gestoresRoles } = await supabase.from("user_roles").select("user_id").in("role", ["gestor", "rh"]);
      const ids = (gestoresRoles ?? []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      return (await supabase.from("employees").select("id, profile:profiles!employees_user_id_profiles_fkey(full_name, email)").in("user_id", ids)).data ?? [];
    },
  });

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas o RH pode acessar esta área." />;

  return (
    <>
      <PageHeader title="Colaboradores" description="Cadastre, vincule a cargos e gestores" action={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo colaborador</Button></DialogTrigger>
          <NewPersonDialog roles={roles} depts={depts} managers={managers as any} onCreated={() => { setOpen(false); qc.invalidateQueries(); }} />
        </Dialog>
      } />
      {people.length === 0 ? <EmptyState title="Nenhum colaborador" description="Comece criando seu primeiro colaborador." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {people.map((p: any) => (
            <Card key={p.id}><CardContent className="pt-6 space-y-2">
              <div className="flex justify-between"><p className="font-medium">{p.profile?.full_name || p.profile?.email}</p>
                <Badge variant="secondary">{p.role?.title ?? "Sem cargo"}</Badge></div>
              <p className="text-sm text-muted-foreground">{p.department?.name ?? "Sem setor"}</p>
              <RoleSwitcher userId={p.user_id} />
              <Link to="/team/$id" params={{ id: p.id }}>
                <Button size="sm" variant="outline" className="w-full"><ListChecks className="mr-2 h-4 w-4" />Abrir / Aplicar entrevista</Button>
              </Link>
            </CardContent></Card>
          ))}
        </div>
      )}
    </>
  );
}

function RoleSwitcher({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const setEmployeeRoleFn = useServerFn(setEmployeeRole);
  const { data: roles = [] } = useQuery({
    queryKey: ["uroles", userId],
    queryFn: async () => (await supabase.from("user_roles").select("role").eq("user_id", userId)).data ?? [],
  });
  const current = (roles[0] as any)?.role ?? "colaborador";
  const set = async (r: string) => {
    try { await ensureServerFnOk(await setEmployeeRoleFn({ data: { userId, role: r as any } }), "Erro ao atualizar papel"); toast.success("Papel atualizado"); qc.invalidateQueries({ queryKey: ["uroles", userId] }); }
    catch (e) { toast.error(await getErrorMessage(e, "Erro ao atualizar papel")); }
  };
  return (
    <div className="flex items-center gap-2"><Label className="text-xs">Papel:</Label>
      <Select value={current} onValueChange={set}>
        <SelectTrigger className="h-8 w-40"><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="colaborador">Colaborador</SelectItem><SelectItem value="gestor">Gestor</SelectItem><SelectItem value="rh">RH/Admin</SelectItem></SelectContent>
      </Select>
    </div>
  );
}

function NewPersonDialog({ roles, depts, managers, onCreated }: any) {
  const createUserAndEmployeeFn = useServerFn(createUserAndEmployee);
  const setEmployeeRoleFn = useServerFn(setEmployeeRole);
  const [email, setEmail] = useState(""); const [name, setName] = useState(""); const [pwd, setPwd] = useState("");
  const [roleId, setRoleId] = useState(""); const [deptId, setDeptId] = useState(""); const [managerId, setManagerId] = useState("");
  const [asManager, setAsManager] = useState(false);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);
  const submit = async () => {
    if (submittingRef.current) return;
    if (!email || !pwd || !name) return toast.error("Preencha nome, e-mail e senha");
    if (pwd.length < 6) return toast.error("A senha provisória deve ter pelo menos 6 caracteres");
    submittingRef.current = true;
    setBusy(true);
    try {
      const res = await ensureServerFnOk(await createUserAndEmployeeFn({ data: { email, password: pwd, fullName: name, roleId: roleId || null, departmentId: deptId || null, managerId: managerId || null } }), "Erro ao criar");
      if (asManager && res?.userId) {
        await ensureServerFnOk(await setEmployeeRoleFn({ data: { userId: res.userId, role: "gestor" } }), "Erro ao definir gestor");
      }
      toast.success(asManager ? "Gestor criado" : "Colaborador criado");
      onCreated();
    } catch (e) {
      toast.error(await getErrorMessage(e, "Erro ao criar"));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{asManager ? "Novo gestor" : "Novo colaborador"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-md border p-3 cursor-pointer">
          <Checkbox checked={asManager} onCheckedChange={(v)=>setAsManager(!!v)} />
          <div className="text-sm"><p className="font-medium">Cadastrar como Gestor</p>
            <p className="text-xs text-muted-foreground">Permite que ele apareça como opção de gestor para outros colaboradores e acesse a aba Equipe.</p></div>
        </label>
        <div className="space-y-1"><Label>Nome completo</Label><Input value={name} onChange={(e)=>setName(e.target.value)} /></div>
        <div className="space-y-1"><Label>E-mail</Label><Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>Senha provisória</Label><Input type="text" value={pwd} onChange={(e)=>setPwd(e.target.value)} /></div>
        <div className="space-y-1"><Label>Cargo</Label>
          <Select value={roleId} onValueChange={setRoleId}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
            <SelectContent>{roles.map((r: any)=><SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Setor</Label>
          <Select value={deptId} onValueChange={setDeptId}><SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
            <SelectContent>{depts.map((d: any)=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
        {!asManager && (
          <div className="space-y-1"><Label>Gestor direto</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder={managers.length === 0 ? "Nenhum gestor cadastrado ainda" : "Sem gestor"}/></SelectTrigger>
              <SelectContent>{managers.map((m: any)=><SelectItem key={m.id} value={m.id}>{m.profile?.full_name || m.profile?.email}</SelectItem>)}</SelectContent></Select>
            {managers.length === 0 && <p className="text-xs text-muted-foreground">Cadastre primeiro um Gestor (marque o checkbox acima).</p>}
          </div>
        )}
      </div>
      <DialogFooter><Button onClick={submit} disabled={busy}>{busy?"Criando...":"Criar"}</Button></DialogFooter>
    </DialogContent>
  );
}
