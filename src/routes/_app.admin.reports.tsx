import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/reports")({ component: Reports });

function Reports() {
  const { isRH } = useAuth();
  const { data } = useQuery({
    queryKey: ["reports"], enabled: isRH,
    queryFn: async () => {
      const [emp, pdis, fbs, gaps] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("pdis").select("status"),
        supabase.from("feedbacks").select("id", { count: "exact", head: true }),
        supabase.from("gaps").select("severity"),
      ]);
      return {
        people: emp.count ?? 0, feedbacks: fbs.count ?? 0,
        pdisActive: (pdis.data ?? []).filter((p: any) => ["aprovado","em_andamento"].includes(p.status)).length,
        pdisDone: (pdis.data ?? []).filter((p: any) => p.status === "concluido").length,
        gapsHigh: (gaps.data ?? []).filter((g: any) => g.severity === "alta").length,
      };
    },
  });
  return (
    <>
      <PageHeader title="Relatórios" description="Visão estratégica de RH" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          ["Colaboradores", data?.people ?? 0],
          ["Feedbacks dados", data?.feedbacks ?? 0],
          ["PDIs ativos", data?.pdisActive ?? 0],
          ["PDIs concluídos", data?.pdisDone ?? 0],
          ["Gaps de alta severidade", data?.gapsHigh ?? 0],
        ].map(([l,v])=>(
          <Card key={l as string}><CardContent className="pt-6">
            <p className="text-xs uppercase text-muted-foreground">{l}</p>
            <p className="mt-1 text-3xl font-semibold">{v as number}</p>
          </CardContent></Card>
        ))}
      </div>
    </>
  );
}
