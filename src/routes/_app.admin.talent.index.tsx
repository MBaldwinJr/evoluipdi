import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Briefcase, Users, UserCheck, TrendingUp, Clock, Target,
  BarChart3, AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/admin/talent/")({ component: TalentDashboard });

type Period = "7" | "30" | "90" | "365";
const PERIOD_LABEL: Record<Period, string> = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias", "365": "Último ano" };

const STAGE_LABEL: Record<string, string> = {
  applied: "Inscrito", screening: "Triagem", interview: "Entrevista",
  technical: "Técnico", offer: "Proposta", hired: "Contratado", rejected: "Rejeitado",
};
const STAGE_COLOR: Record<string, string> = {
  applied: "hsl(var(--chart-1))", screening: "hsl(var(--chart-2))",
  interview: "hsl(var(--chart-3))", technical: "hsl(var(--chart-4))",
  offer: "hsl(var(--chart-5))", hired: "hsl(142 71% 45%)", rejected: "hsl(0 72% 51%)",
};
const FUNNEL_ORDER = ["applied", "screening", "interview", "technical", "offer", "hired"] as const;

function TalentDashboard() {
  const [period, setPeriod] = useState<Period>("30");
  const since = useMemo(() => subDays(new Date(), Number(period)).toISOString(), [period]);

  const { data, isLoading } = useQuery({
    queryKey: ["talent-dashboard", period],
    queryFn: async () => {
      const [jobsR, appsR, hiredR, topJobsR] = await Promise.all([
        supabase.from("jobs").select("id, status, created_at, title"),
        supabase.from("applications").select("id, stage, created_at, updated_at, job_id, rating, ai_fit_score").gte("created_at", since),
        supabase.from("applications").select("id, created_at, updated_at").eq("stage", "hired").gte("updated_at", since),
        supabase.from("applications").select("job_id, jobs!inner(title)").gte("created_at", since),
      ]);
      if (jobsR.error) throw jobsR.error;
      if (appsR.error) throw appsR.error;
      if (hiredR.error) throw hiredR.error;
      if (topJobsR.error) throw topJobsR.error;
      return {
        jobs: jobsR.data ?? [],
        apps: appsR.data ?? [],
        hired: hiredR.data ?? [],
        topJobs: (topJobsR.data ?? []) as Array<{ job_id: string; jobs: { title: string } | null }>,
      };
    },
  });

  if (isLoading || !data) return <DashboardSkeleton />;

  const openJobs = data.jobs.filter((j) => j.status === "open").length;
  const totalApps = data.apps.length;
  const hiredCount = data.hired.length;
  const conversion = totalApps > 0 ? (hiredCount / totalApps) * 100 : 0;
  const rejectedCount = data.apps.filter((a) => a.stage === "rejected").length;
  const rejectionRate = totalApps > 0 ? (rejectedCount / totalApps) * 100 : 0;

  const hireDays = data.hired
    .map((a) => (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / 86_400_000)
    .filter((n) => n >= 0);
  const avgTime = hireDays.length ? hireDays.reduce((s, n) => s + n, 0) / hireDays.length : 0;

  const ratings = data.apps.map((a) => a.ai_fit_score).filter((n): n is number => typeof n === "number");
  const avgFit = ratings.length ? ratings.reduce((s, n) => s + n, 0) / ratings.length : 0;

  const funnel = FUNNEL_ORDER.map((s) => ({
    stage: STAGE_LABEL[s],
    key: s,
    value: data.apps.filter((a) => a.stage === s).length,
    fill: STAGE_COLOR[s],
  }));

  const days = eachDayOfInterval({ start: subDays(new Date(), Number(period) - 1), end: new Date() });
  const trend = days.map((d) => {
    const key = format(d, "yyyy-MM-dd");
    return {
      date: format(d, period === "365" ? "MMM" : "dd/MM", { locale: ptBR }),
      candidaturas: data.apps.filter((a) => a.created_at.startsWith(key)).length,
      contratacoes: data.hired.filter((a) => a.updated_at.startsWith(key)).length,
    };
  });

  const jobCounts = new Map<string, { title: string; count: number }>();
  for (const r of data.topJobs) {
    const t = r.jobs?.title ?? "—";
    const cur = jobCounts.get(r.job_id) ?? { title: t, count: 0 };
    cur.count += 1;
    jobCounts.set(r.job_id, cur);
  }
  const topJobs = [...jobCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  const stageDist = FUNNEL_ORDER.concat("rejected" as never).map((s) => ({
    name: STAGE_LABEL[s], value: data.apps.filter((a) => a.stage === s).length, fill: STAGE_COLOR[s],
  })).filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Dashboard Executivo</h2>
          <p className="text-xs text-muted-foreground">Indicadores em tempo real do funil de recrutamento.</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABEL) as Period[]).map((k) => (
              <SelectItem key={k} value={k}>{PERIOD_LABEL[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={Briefcase} label="Vagas abertas" value={openJobs} hint="Total ativas no momento" />
        <Kpi icon={Users} label="Candidaturas" value={totalApps} hint={PERIOD_LABEL[period]} />
        <Kpi icon={UserCheck} label="Contratações" value={hiredCount} hint={`${conversion.toFixed(1)}% de conversão`} positive={hiredCount > 0} />
        <Kpi icon={Clock} label="Tempo médio" value={`${avgTime.toFixed(0)}d`} hint="Da inscrição à contratação" />
        <Kpi icon={TrendingUp} label="Conversão" value={`${conversion.toFixed(1)}%`} hint="Candidatos → contratados" />
        <Kpi icon={Target} label="Fit score médio" value={avgFit ? avgFit.toFixed(0) : "—"} hint="Aderência IA (0–100)" />
        <Kpi icon={AlertCircle} label="Rejeição" value={`${rejectionRate.toFixed(1)}%`} hint={`${rejectedCount} rejeitados`} />
        <Kpi icon={BarChart3} label="Pipeline ativo" value={totalApps - hiredCount - rejectedCount} hint="Em andamento" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Candidaturas vs Contratações</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="candidaturas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="contratacoes" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por etapa</CardTitle></CardHeader>
          <CardContent className="h-72">
            {stageDist.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stageDist} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {stageDist.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Funil de conversão</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ top: 8, right: 24, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={88} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {funnel.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top vagas por candidaturas</CardTitle></CardHeader>
          <CardContent>
            {topJobs.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Sem dados no período.</p>
            ) : (
              <ul className="divide-y">
                {topJobs.map((j, i) => (
                  <li key={i} className="flex items-center justify-between py-3">
                    <span className="truncate text-sm">{j.title}</span>
                    <Badge variant="secondary">{j.count}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, hint, positive,
}: { icon: React.ElementType; label: string; value: string | number; hint?: string; positive?: boolean }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-semibold tracking-tight ${positive ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
            {value}
          </p>
          {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Nenhum dado no período selecionado.
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
    </div>
  );
}
