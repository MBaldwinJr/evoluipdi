import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/roles")({ component: AdminRoles });

function AdminRoles() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [newDept, setNewDept] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [roleDept, setRoleDept] = useState("");
  const [selRole, setSelRole] = useState<string>("");

  const { data: depts = [] } = useQuery({ queryKey: ["depts"], queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [] });
  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: async () => (await supabase.from("roles_catalog").select("*, department:departments(name)").order("title")).data ?? [] });
  const { data: items = [] } = useQuery({
    queryKey: ["rcf", selRole], enabled: !!selRole,
    queryFn: async () => (await supabase.from("rcf_items").select("*").eq("role_id", selRole).order("sort_order")).data ?? [],
  });

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH." />;

  const addDept = async () => {
    if (!newDept) return;
    const { error } = await supabase.from("departments").insert({ name: newDept });
    if (error) return toast.error(error.message);
    setNewDept(""); qc.invalidateQueries({ queryKey: ["depts"] });
  };
  const addRole = async () => {
    if (!roleTitle) return;
    const { error } = await supabase.from("roles_catalog").insert({ title: roleTitle, department_id: roleDept || null });
    if (error) return toast.error(error.message);
    setRoleTitle(""); qc.invalidateQueries({ queryKey: ["roles"] });
  };

  return (
    <>
      <PageHeader title="Cargos & RCF" description="Setores, cargos e itens de Responsabilidades, Competências e Funções" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Setores</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Novo setor" />
              <Button onClick={addDept}>Adicionar</Button>
            </div>
            <ul className="space-y-1 text-sm">
              {depts.map((d: any) => (
                <DeptRow key={d.id} dept={d} onChanged={() => qc.invalidateQueries({ queryKey: ["depts"] })} />
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cargos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="space-y-2">
              <Input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="Título do cargo" />
              <Select value={roleDept} onValueChange={setRoleDept}>
                <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
                <SelectContent>{depts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={addRole}>Adicionar cargo</Button>
            </div>
            <ul className="space-y-1 text-sm">
              {roles.map((r: any) => (
                <RoleRow
                  key={r.id}
                  role={r}
                  depts={depts}
                  selected={selRole === r.id}
                  onSelect={() => setSelRole(r.id)}
                  onChanged={() => {
                    qc.invalidateQueries({ queryKey: ["roles"] });
                    if (selRole === r.id) setSelRole("");
                  }}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {selRole && <RcfEditor roleId={selRole} items={items} onChange={() => qc.invalidateQueries({ queryKey: ["rcf", selRole] })} />}
    </>
  );
}

function DeptRow({ dept, onChanged }: { dept: any; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(dept.name);

  const save = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("departments").update({ name: name.trim() }).eq("id", dept.id);
    if (error) return toast.error(error.message);
    setEditing(false); onChanged();
  };
  const remove = async () => {
    const { error } = await supabase.from("departments").delete().eq("id", dept.id);
    if (error) return toast.error(error.message);
    toast.success("Setor removido"); onChanged();
  };

  return (
    <li className="flex items-center justify-between gap-2 rounded border px-3 py-1">
      {editing ? (
        <>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-7" />
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={save}><Check className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(false); setName(dept.name); }}><X className="h-4 w-4" /></Button>
          </div>
        </>
      ) : (
        <>
          <span>{dept.name}</span>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>
            <ConfirmDelete title={`Excluir setor "${dept.name}"?`} description="Cargos vinculados ficarão sem setor." onConfirm={remove} />
          </div>
        </>
      )}
    </li>
  );
}

function RoleRow({ role, depts, selected, onSelect, onChanged }: any) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(role.title);
  const [deptId, setDeptId] = useState<string>(role.department_id ?? "");

  const save = async () => {
    if (!title.trim()) return;
    const { error } = await supabase.from("roles_catalog").update({ title: title.trim(), department_id: deptId || null }).eq("id", role.id);
    if (error) return toast.error(error.message);
    setEditing(false); onChanged();
  };
  const remove = async () => {
    const { error } = await supabase.from("roles_catalog").delete().eq("id", role.id);
    if (error) return toast.error(error.message);
    toast.success("Cargo removido"); onChanged();
  };

  if (editing) {
    return (
      <li className="space-y-2 rounded border border-primary px-3 py-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8" />
        <Select value={deptId} onValueChange={setDeptId}>
          <SelectTrigger className="h-8"><SelectValue placeholder="Sem setor" /></SelectTrigger>
          <SelectContent>{depts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setTitle(role.title); setDeptId(role.department_id ?? ""); }}>Cancelar</Button>
          <Button size="sm" onClick={save}>Salvar</Button>
        </div>
      </li>
    );
  }

  return (
    <li className={`flex items-center justify-between gap-2 rounded border px-3 py-1 ${selected ? "border-primary bg-accent" : ""}`}>
      <button type="button" onClick={onSelect} className="flex-1 text-left">{role.title}</button>
      <Badge variant="secondary">{role.department?.name ?? "—"}</Badge>
      <div className="flex gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditing(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
        <ConfirmDelete title={`Excluir cargo "${role.title}"?`} description="Itens RCF vinculados serão removidos." onConfirm={remove} />
      </div>
    </li>
  );
}

function ConfirmDelete({ title, description, onConfirm }: { title: string; description: string; onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={(e) => e.stopPropagation()}><Trash2 className="h-3.5 w-3.5" /></Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Excluir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RcfEditor({ roleId, items, onChange }: { roleId: string; items: any[]; onChange: () => void }) {
  const [title, setTitle] = useState(""); const [kind, setKind] = useState("competencia_tecnica"); const [level, setLevel] = useState("3");
  const add = async () => {
    if (!title) return;
    const { error } = await supabase.from("rcf_items").insert({ role_id: roleId, title, kind: kind as any, expected_level: parseInt(level) });
    if (error) return toast.error(error.message);
    setTitle(""); onChange();
  };
  const del = async (id: string) => { await supabase.from("rcf_items").delete().eq("id", id); onChange(); };

  return (
    <Card className="mt-4"><CardHeader><CardTitle className="text-base">Itens RCF do cargo selecionado</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <Input className="md:col-span-2" placeholder="Título do item" value={title} onChange={(e)=>setTitle(e.target.value)} />
          <Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="responsabilidade">Responsabilidade</SelectItem>
              <SelectItem value="competencia_tecnica">Competência técnica</SelectItem>
              <SelectItem value="competencia_comportamental">Competência comportamental</SelectItem>
              <SelectItem value="indicador">Indicador</SelectItem>
            </SelectContent></Select>
          <Select value={level} onValueChange={setLevel}><SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>{[1,2,3,4,5].map(n=><SelectItem key={n} value={String(n)}>Nível esperado {n}</SelectItem>)}</SelectContent></Select>
        </div>
        <Button onClick={add} size="sm">Adicionar item</Button>
        <ul className="space-y-1">{items.map((i)=>(
          <li key={i.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
            <span><Badge variant="outline" className="mr-2">{i.kind}</Badge>{i.title} <span className="text-muted-foreground">· nível {i.expected_level}</span></span>
            <Button size="sm" variant="ghost" onClick={()=>del(i.id)}>Remover</Button>
          </li>))}</ul>
      </CardContent></Card>
  );
}
