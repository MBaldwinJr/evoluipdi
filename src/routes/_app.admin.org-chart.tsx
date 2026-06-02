import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listOrgChartFn, setEmployeeManagerFn } from "@/lib/admin.functions";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { OrgChart } from "@/components/org-chart";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/admin/org-chart")({ component: OrgPage });

function OrgPage() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const listFn = useServerFn(listOrgChartFn);
  const setMgr = useServerFn(setEmployeeManagerFn);
  const { data: people = [], isLoading } = useQuery({
    queryKey: ["org-chart"],
    queryFn: () => listFn(),
    enabled: isRH,
  });

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH." />;

  return (
    <>
      <PageHeader
        title="Organograma"
        description="Visualize e reorganize a hierarquia da empresa. Clique com o botão direito em um colaborador para reassociar o gestor."
        action={
          <Button asChild variant="outline">
            <Link to="/admin/people"><ArrowLeft className="mr-2 h-4 w-4" />Voltar à lista</Link>
          </Button>
        }
      />
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : people.length === 0 ? (
        <EmptyState title="Sem colaboradores" description="Cadastre colaboradores para visualizar o organograma." />
      ) : (
        <OrgChart
          people={people}
          onSetManager={async (employeeId, managerId) => {
            await setMgr({ data: { employeeId, managerId } });
            await qc.invalidateQueries({ queryKey: ["org-chart"] });
          }}
        />
      )}
    </>
  );
}
