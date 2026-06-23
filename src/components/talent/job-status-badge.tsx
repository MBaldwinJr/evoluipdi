import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/talent.types";

const variants: Record<JobStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  paused: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  closed: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  cancelled: "bg-destructive/15 text-destructive",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge variant="outline" className={variants[status]}>
      {JOB_STATUS_LABEL[status]}
    </Badge>
  );
}
