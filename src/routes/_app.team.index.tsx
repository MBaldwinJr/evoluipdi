import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/team/")({ component: TeamPage });

function TeamPage() {
  const { user, isGestor } = useAuth();
  const { data: me } = useQuery({
    queryKey: ["me-emp-team", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: team = [] } = useQuery({
    queryKey: ["team", me?.id], enabled: !!me,
    queryFn: async () => (await supabase.from("employees").select("id, user_id, profile:profiles(full_name, email), role:roles_catalog(title)").eq("manager_id", me!.id)).data ?? [],
  });

  if (!isGestor) return <EmptyState title="Acesso restrito" description="Apenas gestores podem visualizar essa área." />;

  return (
    <>
      <PageHeader title="Minha equipe" description="Acompanhe seus liderados, dê feedback e valide PDIs" />
      {team.length === 0 ? (
        <EmptyState title="Sem liderados" description="Você ainda não tem colaboradores vinculados como gestor direto." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {team.map((m: any) => (
            <Link key={m.id} to="/team/$id" params={{ id: m.id }}>
              <Card className="transition hover:border-primary"><CardContent className="pt-6">
                <p className="font-medium">{m.profile?.full_name || m.profile?.email}</p>
                <p className="text-sm text-muted-foreground">{m.role?.title ?? "Sem cargo"}</p>
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
