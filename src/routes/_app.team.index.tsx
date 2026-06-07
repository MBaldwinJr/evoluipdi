import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export const Route = createFileRoute("/_app/team/")({ component: TeamPage });

function TeamPage() {
  const { user, isGestor, isRH } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const { data: me } = useQuery({
    queryKey: ["me-emp-team", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team", isRH ? "all" : me?.id], enabled: isRH || !!me,
    queryFn: async () => {
      const { data } = await supabase.rpc("list_team_directory");
      const rows = (data ?? []) as any[];
      const filtered = !isRH && me?.id ? rows.filter((r) => r.manager_id === me.id) : rows;
      return filtered.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        profile: { full_name: r.full_name },
        role: { id: r.role_id, title: r.role_title },
        department: { id: r.department_id, name: r.department_name },
      }));
    },
  });

  if (!isGestor) return <EmptyState title="Acesso restrito" description="Apenas gestores e RH podem visualizar essa área." />;

  const roleOptions = Array.from(new Map(team.map((m: any) => m.role).filter((r: any) => r?.id).map((r: any) => [r.id, r])).values()) as any[];
  const deptOptions = Array.from(new Map(team.map((m: any) => m.department).filter((d: any) => d?.id).map((d: any) => [d.id, d])).values()) as any[];

  const q = search.trim().toLowerCase();
  const filteredTeam = team.filter((m: any) => {
    if (roleFilter !== "all" && m.role?.id !== roleFilter) return false;
    if (deptFilter !== "all" && m.department?.id !== deptFilter) return false;
    if (q && !(m.profile?.full_name ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title={isRH ? "Colaboradores da empresa" : "Minha equipe"}
        description={isRH ? "Selecione um colaborador para aplicar entrevista, dar feedback ou validar PDI" : "Acompanhe seus liderados, dê feedback e valide PDIs"}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input placeholder="Buscar por nome…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cargos</SelectItem>
            {roleOptions.map((r) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {deptOptions.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="ml-auto self-center text-xs text-muted-foreground">{filteredTeam.length} de {team.length}</p>
      </div>
      {filteredTeam.length === 0 ? (
        <EmptyState title={isRH ? "Nenhum colaborador" : "Sem liderados"} description={isRH ? "Ajuste filtros ou cadastre colaboradores." : "Você ainda não tem colaboradores vinculados como gestor direto."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filteredTeam.map((m: any) => (
            <Link key={m.id} to="/team/$id" params={{ id: m.id }}>
              <Card className="h-full transition hover:border-primary"><CardContent className="pt-6 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{m.profile?.full_name || m.profile?.email}</p>
                  {m.role?.title && <Badge variant="secondary" className="shrink-0">{m.role.title}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{m.department?.name ?? "Sem setor"}</p>
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
