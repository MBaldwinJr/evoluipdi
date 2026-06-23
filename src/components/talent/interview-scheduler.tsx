import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarPlus, Loader2, Trash2, Check, X, Video, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  INTERVIEW_MODES, scheduleInterview, updateInterview, deleteInterview,
  listInterviewsByApplication, type InterviewMode, type InterviewStatus,
} from "@/lib/candidate-interviews.functions";

const MODE_LABEL: Record<InterviewMode, string> = {
  online: "Online", presencial: "Presencial", telefone: "Telefone",
};
const MODE_ICON: Record<InterviewMode, typeof Video> = {
  online: Video, presencial: MapPin, telefone: Phone,
};
const STATUS_LABEL: Record<InterviewStatus, string> = {
  scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada", no_show: "Não compareceu",
};
const STATUS_TONE: Record<InterviewStatus, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function InterviewScheduler({ applicationId }: { applicationId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listInterviewsByApplication);
  const create = useServerFn(scheduleInterview);
  const update = useServerFn(updateInterview);
  const del = useServerFn(deleteInterview);

  const [open, setOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(45);
  const [mode, setMode] = useState<InterviewMode>("online");
  const [location, setLocation] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [interviewer, setInterviewer] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["interviews", applicationId],
    queryFn: () => list({ data: { application_id: applicationId } }),
  });

  const reset = () => {
    setScheduledAt(""); setDuration(45); setMode("online");
    setLocation(""); setMeetingUrl(""); setInterviewer(""); setNotes("");
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["interviews", applicationId] });

  const submit = async () => {
    if (!scheduledAt) { toast.error("Informe data e hora"); return; }
    setSaving(true);
    try {
      await create({ data: {
        application_id: applicationId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_min: duration,
        mode,
        location: mode === "presencial" ? location : null,
        meeting_url: mode === "online" ? meetingUrl : null,
        interviewer_name: interviewer || null,
        notes: notes || null,
      }});
      toast.success("Entrevista agendada");
      reset(); setOpen(false); invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  const changeStatus = async (id: string, status: InterviewStatus) => {
    try { await update({ data: { id, status } }); invalidate(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const remove = async (id: string) => {
    if (!confirm("Cancelar este agendamento?")) return;
    try { await del({ data: { id } }); invalidate(); toast.success("Removido"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">Entrevistas</span>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          <CalendarPlus className="mr-1 h-3 w-3" /> {open ? "Cancelar" : "Agendar"}
        </Button>
      </div>

      {open && (
        <div className="mb-3 grid gap-2 rounded-md border bg-muted/30 p-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Data e hora</Label>
              <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Duração (min)</Label>
              <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1">
              <Label className="text-xs">Modalidade</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as InterviewMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTERVIEW_MODES.map((m) => <SelectItem key={m} value={m}>{MODE_LABEL[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">Entrevistador</Label>
              <Input value={interviewer} onChange={(e) => setInterviewer(e.target.value)} placeholder="Nome" />
            </div>
          </div>
          {mode === "online" && (
            <div className="grid gap-1">
              <Label className="text-xs">Link da reunião</Label>
              <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/..." />
            </div>
          )}
          {mode === "presencial" && (
            <div className="grid gap-1">
              <Label className="text-xs">Local</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Endereço / sala" />
            </div>
          )}
          <div className="grid gap-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Confirmar agendamento
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : interviews.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma entrevista agendada.</p>
      ) : (
        <ul className="space-y-2">
          {interviews.map((iv) => {
            const Icon = MODE_ICON[iv.mode];
            const when = new Date(iv.scheduled_at);
            return (
              <li key={iv.id} className="rounded border bg-background p-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {when.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      <span className="ml-1 text-muted-foreground">· {iv.duration_min}min</span>
                    </p>
                    <p className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      {MODE_LABEL[iv.mode]}
                      {iv.interviewer_name && <> · {iv.interviewer_name}</>}
                    </p>
                    {iv.meeting_url && (
                      <a href={iv.meeting_url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-primary hover:underline">
                        {iv.meeting_url}
                      </a>
                    )}
                    {iv.location && <p className="mt-0.5 text-muted-foreground">{iv.location}</p>}
                  </div>
                  <Badge className={STATUS_TONE[iv.status]} variant="outline">{STATUS_LABEL[iv.status]}</Badge>
                </div>
                {iv.status === "scheduled" && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => changeStatus(iv.id, "completed")}>
                      <Check className="mr-1 h-3 w-3" />Realizada
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => changeStatus(iv.id, "no_show")}>
                      <X className="mr-1 h-3 w-3" />Não veio
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => remove(iv.id)}>
                      <Trash2 className="mr-1 h-3 w-3" />Cancelar
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
