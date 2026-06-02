import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProcessFlow, saveProcessFlow } from "@/lib/flow.functions";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ProcessFlowEditor } from "@/components/process-flow-editor";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/processes/$processId/flow")({ component: FlowPage });

function FlowPage() {
  const { processId } = Route.useParams();
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const getFn = useServerFn(getProcessFlow);
  const saveFn = useServerFn(saveProcessFlow);

  const { data, isLoading, error } = useQuery({
    queryKey: ["process-flow", processId],
    queryFn: () => getFn({ data: { processId } }),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data) return <EmptyState title="Erro" description={(error as any)?.message ?? "Processo não encontrado."} />;

  return (
    <>
      <PageHeader
        title={`Fluxograma · ${data.process.title}`}
        description={isRH ? "Edite o fluxo, conecte etapas e salve." : "Visualização do fluxo do processo."}
        action={
          <Button asChild variant="outline">
            <Link to="/admin/processes"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
          </Button>
        }
      />
      <ProcessFlowEditor
        initial={data.flow}
        readOnly={!isRH}
        onSave={async (doc) => {
          try {
            await saveFn({ data: { processId, nodes: doc.nodes, edges: doc.edges } });
            toast.success("Fluxograma salvo");
            await qc.invalidateQueries({ queryKey: ["process-flow", processId] });
            await qc.invalidateQueries({ queryKey: ["role-processes"] });
          } catch (e: any) {
            toast.error(e.message ?? "Falha ao salvar");
          }
        }}
      />
    </>
  );
}
