import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calendar, Video, MapPin, Phone, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  listUpcomingInterviews, type InterviewMode, type InterviewStatus,
} from "@/lib/candidate-interviews.functions";

export const Route = createFileRoute("/_app/admin/talent/interviews")({
  component: InterviewsPage,
});

const MODE_LABEL: Record<InterviewMode, string> = { online: "Online", presencial: "Presencial", telefone: "Telefone" };
const MODE_ICON: Record<InterviewMode, typeof Video> = { online: Video, presencial: MapPin, telefone: Phone };
const STATUS_LABEL: Record<InterviewStatus, string> = {
  scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada", no_show: "Não compareceu",
};
const STATUS_TONE: Record<InterviewStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
};

function groupByDay<T extends { scheduled_at: string }>(rows: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = new Date(r.scheduled_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    const arr = groups.get(key) ?? [];
    arr.push(r);
    groups.set(key, arr);
  }
  return Array.from(groups.entries());
}

function InterviewsPage() {
  const fetchList = useServerFn(listUpcomingInterviews);
  const { data = [], isLoading } = useQuery({
    queryKey: ["upcoming-interviews"],
    queryFn: () => fetchList(),
  });

  const upcoming = data.filter((i) => i.status === "scheduled" && new Date(i.scheduled_at) >= new Date());
  const past = data.filter((i) => !(i.status === "scheduled" && new Date(i.scheduled_at) >= new Date()));

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold">Entrevistas</h2>
        <p className="text-sm text-muted-foreground">Próximos agendamentos com candidatos.</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <section className="space-y-4">
            <h3 className="text-sm font-medium">Próximas ({upcoming.length})</h3>
            {upcoming.length === 0 ? (
              <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                Nenhuma entrevista agendada.
              </p>
            ) : (
              groupByDay(upcoming).map(([day, items]) => (
                <div key={day}>
                  <p className="mb-2 inline-flex items-center gap-1 text-xs font-medium uppercase text-muted-foreground">
                    <Calendar className="h-3 w-3" />{day}
                  </p>
                  <ul className="space-y-2">
                    {items.map((iv) => <InterviewRow key={iv.id} iv={iv} />)}
                  </ul>
                </div>
              ))
            )}
          </section>

          {past.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">Histórico</h3>
              <ul className="space-y-2">
                {past.slice(0, 30).map((iv) => <InterviewRow key={iv.id} iv={iv} muted />)}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function InterviewRow({ iv, muted }: { iv: Awaited<ReturnType<typeof listUpcomingInterviews>>[number]; muted?: boolean }) {
  const Icon = MODE_ICON[iv.mode];
  const when = new Date(iv.scheduled_at);
  return (
    <li className={`rounded-md border bg-background p-3 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{iv.candidate_name} <span className="text-muted-foreground">· {iv.job_title}</span></p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {when.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · {iv.duration_min} min
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Icon className="h-3 w-3" />{MODE_LABEL[iv.mode]}
            {iv.interviewer_name && <> · {iv.interviewer_name}</>}
          </p>
          {iv.meeting_url && (
            <a href={iv.meeting_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-primary hover:underline">
              {iv.meeting_url}
            </a>
          )}
          {iv.location && <p className="mt-1 text-xs text-muted-foreground">{iv.location}</p>}
        </div>
        <Badge variant="outline" className={STATUS_TONE[iv.status]}>{STATUS_LABEL[iv.status]}</Badge>
      </div>
    </li>
  );
}
