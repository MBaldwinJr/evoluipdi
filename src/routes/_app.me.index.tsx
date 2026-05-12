import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { MessageSquare, Target, TrendingUp, Users, Briefcase, ListChecks, FileText, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/me/")({
  component: MePage,
});

function MePage() {
  const { user, isRH, isGestor } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["me-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: emp } = await supabase
        .from("employees")
        .select("*, role:roles_catalog(title), department:departments(name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!emp) return { emp: null };
      const [{ data: pdis }, { data: feedbacks }, { data: actions }] = await Promise.all([
        supabase.from("pdis").select("*").eq("employee_id", emp.id).order("created_at", { ascending: false }),
        supabase.from("feedbacks").select("*").eq("employee_id", emp.id).order("occurred_at", { ascending: false }).limit(5),
        supabase.from("pdi_actions").select("status, development_point:pdi_development_points!inner(pdi:pdis!inner(employee_id))").eq("development_point.pdi.employee_id", emp.id),
      ]);
      const total = actions?.length ?? 0;
      const done = actions?.filter((a) => a.status === "concluida").length ?? 0;
      return { emp, pdis: pdis ?? [], feedbacks: feedbacks ?? [], totalActions: total, doneActions: done };
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  // RH sem registro de colaborador → painel administrativo
  if (!data?.emp && isRH) return <RHDashboard />;

  if (!data?.emp) {
    return (
      <>
        <PageHeader title="Meu painel" description="Sua jornada de desenvolvimento" />
        {isGestor ? (
          <EmptyState
            title="Você ainda não é um colaborador"
            description="Seu perfil é de Gestor. Acesse a aba Minha equipe para acompanhar seus liderados."
          />
        ) : (
          <EmptyState
            title="Cadastro pendente"
            description="Seu RH ainda não vinculou seu perfil a um cargo. Procure o time de RH para concluir seu cadastro."
          />
        )}
      </>
    );
  }

  const activePdi = data.pdis.find((p) => ["em_andamento", "aprovado", "aguardando_validacao"].includes(p.status));
  const progress = data.totalActions ? Math.round((data.doneActions / data.totalActions) * 100) : 0;

  return (
    <>
      <PageHeader title="Meu painel" description={`${(data.emp as any).role?.title ?? "Sem cargo"} · ${(data.emp as any).department?.name ?? "Sem setor"}`} />

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard icon={Target} label="PDI ativo" value={activePdi ? statusLabel(activePdi.status) : "Nenhum"} />
        <KpiCard icon={TrendingUp} label="Progresso de ações" value={`${progress}%`} extra={<Progress value={progress} className="mt-2" />} />
        <KpiCard icon={MessageSquare} label="Feedbacks recebidos" value={String(data.feedbacks.length)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meu PDI</CardTitle>
            <CardDescription>Evolução do seu plano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activePdi ? (
              <>
                <p className="text-sm">{activePdi.objective}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{horizonLabel(activePdi.horizon)}</Badge>
                  <Badge>{statusLabel(activePdi.status)}</Badge>
                </div>
                <Link to="/me/pdi" className="text-sm font-medium text-primary hover:underline">Abrir PDI →</Link>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">
                Você ainda não tem um PDI ativo. <Link to="/me/pdi" className="font-medium text-primary hover:underline">Criar agora</Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos feedbacks</CardTitle>
            <CardDescription>O que você recebeu</CardDescription>
          </CardHeader>
          <CardContent>
            {data.feedbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum feedback ainda.</p>
            ) : (
              <ul className="space-y-3">
                {data.feedbacks.map((f) => (
                  <li key={f.id} className="border-l-2 border-primary/40 pl-3">
                    <p className="text-sm">{f.fact}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(f.occurred_at).toLocaleDateString("pt-BR")} · {f.kind}</p>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/me/feedbacks" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Ver todos →</Link>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RHDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["rh-dashboard-stats"],
    queryFn: async () => {
      const since = new Date(); since.setDate(1); since.setHours(0,0,0,0);
      const [emps, roles, depts, pdisPend, intMonth] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("active", true),
        supabase.from("roles_catalog").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("pdis").select("id", { count: "exact", head: true }).eq("status", "aguardando_validacao"),
        supabase.from("interviews").select("id", { count: "exact", head: true }).gte("occurred_at", since.toISOString()),
      ]);
      return {
        employees: emps.count ?? 0,
        roles: roles.count ?? 0,
        depts: depts.count ?? 0,
        pdisPend: pdisPend.count ?? 0,
        intMonth: intMonth.count ?? 0,
      };
    },
  });

  return (
    <>
      <PageHeader title="Painel do RH" description="Visão geral da operação de pessoas" />
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard icon={Users} label="Colaboradores" value={String(stats?.employees ?? "—")} />
        <KpiCard icon={Briefcase} label="Cargos" value={String(stats?.roles ?? "—")} />
        <KpiCard icon={Briefcase} label="Setores" value={String(stats?.depts ?? "—")} />
        <KpiCard icon={Target} label="PDIs aguardando" value={String(stats?.pdisPend ?? "—")} />
        <KpiCard icon={ListChecks} label="Entrevistas no mês" value={String(stats?.intMonth ?? "—")} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ActionCard icon={UserPlus} title="Cadastrar colaborador" desc="Novo usuário e vínculo a cargo/gestor" to="/admin/people" />
        <ActionCard icon={Briefcase} title="Cargos & RCF" desc="Gerencie cargos, setores e competências" to="/admin/roles" />
        <ActionCard icon={ListChecks} title="Aplicar entrevista" desc="Inicie um wizard de entrevista" to="/team" />
        <ActionCard icon={FileText} title="Relatórios" desc="Gaps, PDIs e feedbacks" to="/admin/reports" />
      </div>
    </>
  );
}

function ActionCard({ icon: Icon, title, desc, to }: { icon: any; title: string; desc: string; to: string }) {
  return (
    <Link to={to}>
      <Card className="h-full transition hover:border-primary">
        <CardContent className="pt-6">
          <div className="mb-3 inline-flex rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{desc}</p>
          <Button variant="link" className="mt-2 h-auto p-0 text-primary">Abrir →</Button>
        </CardContent>
      </Card>
    </Link>
  );
}

function KpiCard({ icon: Icon, label, value, extra }: { icon: any; label: string; value: string; extra?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        </div>
        {extra}
      </CardContent>
    </Card>
  );
}

function statusLabel(s: string) {
  return ({ rascunho: "Rascunho", aguardando_validacao: "Aguardando validação", aprovado: "Aprovado", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" } as any)[s] ?? s;
}
function horizonLabel(h: string) {
  return ({ curto: "Curto prazo", medio: "Médio prazo", longo: "Longo prazo" } as any)[h] ?? h;
}
