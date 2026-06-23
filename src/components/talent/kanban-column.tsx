import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ApplicationCard, type ApplicationCardData } from "./application-card";
import { APPLICATION_STAGE_LABEL, type ApplicationStage } from "@/lib/talent-pool.types";
import { cn } from "@/lib/utils";

export function KanbanColumn({
  stage, items, onCardClick,
}: {
  stage: ApplicationStage;
  items: ApplicationCardData[];
  onCardClick: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const tone =
    stage === "hired" ? "border-emerald-500/30"
      : stage === "rejected" ? "border-destructive/30"
        : "border-border";
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30 transition-colors",
        tone,
        isOver && "bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-semibold">{APPLICATION_STAGE_LABEL[stage]}</span>
        <span className="rounded bg-background px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
      </div>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 p-2 min-h-32">
          {items.map((app) => (
            <ApplicationCard key={app.id} app={app} onClick={() => onCardClick(app.id)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
