import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import { ArrowLeft, Loader2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/page-header";
import { KanbanColumn } from "@/components/talent/kanban-column";
import { ApplicationDrawer } from "@/components/talent/application-drawer";
import { TalentPickerDialog } from "@/components/talent/talent-picker-dialog";
import {
  APPLICATION_STAGES, type ApplicationStage,
} from "@/lib/talent-pool.types";
import { moveApplication } from "@/lib/talent-pool.functions";

export const Route = createFileRoute("/_app/admin/talent/jobs_/$jobId/kanban")({
  component: KanbanPage,
});

type AppRow = {
  id: string;
  stage: ApplicationStage;
  stage_order: number;
  rating: number | null;
  ai_fit_score: number | null;
  talent: { full_name: string; current_position: string | null; skills: string[] | null } | null;
};

function KanbanPage() {
  const { jobId } = Route.useParams();
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const move = useServerFn(moveApplication);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: job } = useQuery({
    queryKey: ["job-header", jobId],
    queryFn: async () => (await supabase.from("jobs").select("id,title,code").eq("id", jobId).single()).data,
  });

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["job-applications", jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, stage, stage_order, rating, ai_fit_score, talent:talent_pool(full_name,current_position,skills)")
        .eq("job_id", jobId)
        .order("stage_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AppRow[];
    },
  });

  const byStage = useMemo(() => {
    const m: Record<ApplicationStage, AppRow[]> = {
      applied: [], screening: [], interview: [], technical: [], offer: [], hired: [], rejected: [],
    };
    for (const a of apps) m[a.stage]?.push(a);
    return m;
  }, [apps]);

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH." />;

  const refresh = () => qc.invalidateQueries({ queryKey: ["job-applications", jobId] });

  const onDragEnd = async (e: DragEndEvent) => {
    const activeId = e.active.id as string;
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const active = apps.find((a) => a.id === activeId);
    if (!active) return;

    let targetStage: ApplicationStage;
    let targetOrder: number;

    if (APPLICATION_STAGES.includes(overId as ApplicationStage)) {
      targetStage = overId as ApplicationStage;
      targetOrder = (byStage[targetStage]?.length ?? 0);
    } else {
      const overApp = apps.find((a) => a.id === overId);
      if (!overApp) return;
      targetStage = overApp.stage;
      targetOrder = overApp.stage_order ?? 0;
    }

    if (active.stage === targetStage && active.stage_order === targetOrder) return;

    try {
      await move({ data: { id: activeId, stage: targetStage, stage_order: targetOrder } });
      refresh();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Erro ao mover"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/talent/jobs"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{job?.title ?? "Vaga"}</h2>
          {job?.code && <p className="text-xs text-muted-foreground">{job.code}</p>}
        </div>
        <div className="ml-auto">
          <Button onClick={() => setPickerOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" />Adicionar candidato
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {APPLICATION_STAGES.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                items={byStage[stage] ?? []}
                onCardClick={setSelected}
              />
            ))}
          </div>
        </DndContext>
      )}

      <ApplicationDrawer
        applicationId={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        onChanged={refresh}
      />
      <TalentPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        jobId={jobId}
        onAdded={() => { setPickerOpen(false); refresh(); }}
      />
    </div>
  );
}
