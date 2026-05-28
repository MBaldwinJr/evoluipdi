import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ptGetDashboard } from "@/lib/pt.functions";
import { usePtCompany } from "@/lib/pt-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, AlertTriangle, MapPinOff, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/pt/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { current } = usePtCompany();
  const fn = useServerFn(ptGetDashboard);
  const q = useQuery({
    queryKey: ["pt", "dashboard", current?.id],
    queryFn: () => fn({ data: { company_id: current!.id } }),
    enabled: !!current,
  });

  if (!current) return null;
  if (q.isLoading) return <div>Carregando...</div>;
  if (q.isError) return <div className="text-destructive">{(q.error as Error).message}</div>;

  const k = q.data!;
  const cards = [
    { label: "Funcionários ativos", val: k.activeEmployees, icon: Users },
    { label: "Trabalhando agora", val: k.workingNow, icon: Activity },
    { label: "Batidas hoje", val: k.punchesToday, icon: Clock },
    { label: "Fora da cerca hoje", val: k.outFence, icon: MapPinOff, warn: k.outFence > 0 },
    { label: "Anomalias abertas", val: k.openAnomalies, icon: AlertTriangle, warn: k.openAnomalies > 0 },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs text-muted-foreground">{c.label}</CardTitle>
            <c.icon className={`h-4 w-4 ${c.warn ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent className={`text-2xl font-semibold ${c.warn ? "text-destructive" : ""}`}>{c.val}</CardContent>
        </Card>
      ))}
    </div>
  );
}
