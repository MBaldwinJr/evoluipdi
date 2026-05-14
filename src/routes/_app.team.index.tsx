import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/team/")({ component: TeamPage });

function TeamPage() {
  const { user, isGestor, isRH } = useAuth();
  const { data: me } = useQuery({
    queryKey: ["me-emp-team", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team", isRH ? "all" : me?.id], enabled: isRH || !!me,
    queryFn: async () => {
      let q = supabase.from("employees").select("id, user_id, profile:profiles!employees_user_id_profiles_fkey(full_name, email), role:roles_catalog(title), department:departments(name)").eq("active", true);
      if (!isRH && me?.id) q = q.eq("manager_id", me.id);
      return (await q).data ?? [];
    },
  });

  if (!isGestor) return <EmptyState title="Acesso restrito" description="Apenas gestores e RH podem visualizar essa área." />;

  return (
    <>
      <PageHeader
        title={isRH ? "Colaboradores da empresa" : "Minha equipe"}
        description={isRH ? "Selecione um colaborador para aplicar entrevista, dar feedback ou validar PDI" : "Acompanhe seus liderados, dê feedback e valide PDIs"}
      />
      {team.length === 0 ? (
        <EmptyState title={isRH ? "Nenhum colaborador" : "Sem liderados"} description={isRH ? "Cadastre colaboradores em Colaboradores." : "Você ainda não tem colaboradores vinculados como gestor direto."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {team.map((m: any) => (
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
