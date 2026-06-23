import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Sparkles } from "lucide-react";

export type ApplicationCardData = {
  id: string;
  rating: number | null;
  ai_fit_score: number | null;
  talent: { full_name: string; current_position: string | null; skills: string[] | null } | null;
};

export function ApplicationCard({ app, onClick }: { app: ApplicationCardData; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  const skills = (app.talent?.skills ?? []).slice(0, 3);
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab space-y-2 p-3 hover:border-primary/50 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{app.talent?.full_name ?? "—"}</p>
          {app.talent?.current_position && (
            <p className="truncate text-xs text-muted-foreground">{app.talent.current_position}</p>
          )}
        </div>
        {app.ai_fit_score != null && (
          <Badge variant="outline" className="gap-1 text-xs">
            <Sparkles className="h-3 w-3" />
            {app.ai_fit_score}
          </Badge>
        )}
      </div>
      {(skills.length > 0 || app.rating) && (
        <div className="flex flex-wrap items-center gap-1">
          {skills.map((s) => (
            <Badge key={s} variant="secondary" className="text-[10px] font-normal">{s}</Badge>
          ))}
          {app.rating && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-xs text-amber-500">
              <Star className="h-3 w-3 fill-current" />{app.rating}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
