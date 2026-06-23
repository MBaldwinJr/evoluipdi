import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  APPLICATION_STAGES, APPLICATION_STAGE_LABEL, type ApplicationStage,
} from "@/lib/talent-pool.types";
import {
  updateApplication, deleteApplication, scoreApplicationAI, moveApplication, admitApplication,
} from "@/lib/talent-pool.functions";
import { InterviewScheduler } from "./interview-scheduler";

export function ApplicationDrawer({
  applicationId, onOpenChange, onChanged,
}: {
  applicationId: string | null;
  onOpenChange: (o: boolean) => void;
  onChanged: () => void;
}) {
  const open = !!applicationId;
  const qc = useQueryClient();
  const update = useServerFn(updateApplication);
  const move = useServerFn(moveApplication);
  const del = useServerFn(deleteApplication);
  const score = useServerFn(scoreApplicationAI);
  const admit = useServerFn(admitApplication);

  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [scoring, setScoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [admitting, setAdmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["application", applicationId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, talent:talent_pool(*), job:jobs(id,title), events:application_events(id,event_type,payload,created_at)")
        .eq("id", applicationId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setNotes(data?.notes ?? "");
    setRating(data?.rating ?? "");
    setReason(data?.rejection_reason ?? "");
  }, [data?.id]);

  if (!open) return null;

  const onStageChange = async (s: ApplicationStage) => {
    if (!data) return;
    try {
      await move({ data: { id: data.id, stage: s, stage_order: data.stage_order ?? 0 } });
      qc.invalidateQueries({ queryKey: ["application", data.id] });
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const onSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      await update({ data: {
        id: data.id, stage: data.stage,
        notes: notes || null,
        rating: rating === "" ? null : Number(rating),
        rejection_reason: reason || null,
      }});
      toast.success("Salvo");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  };

  const runAI = async () => {
    if (!data) return;
    setScoring(true);
    try {
      await score({ data: { application_id: data.id } });
      toast.success("Avaliação concluída");
      qc.invalidateQueries({ queryKey: ["application", data.id] });
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setScoring(false); }
  };

  const onDelete = async () => {
    if (!data || !confirm("Remover este candidato da vaga?")) return;
    try {
      await del({ data: { id: data.id } });
      toast.success("Removido");
      onOpenChange(false);
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  };

  const onAdmit = async () => {
    if (!data) return;
    if (!confirm(`Admitir ${data.talent?.full_name ?? "candidato"} como colaborador?`)) return;
    setAdmitting(true);
    try {
      const res = await admit({ data: { application_id: data.id } });
      toast.success("Admissão concluída");
      qc.invalidateQueries({ queryKey: ["application", data.id] });
      onChanged();
      return res;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setAdmitting(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{data?.talent?.full_name ?? "Candidato"}</SheetTitle>
        </SheetHeader>

        {isLoading || !data ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="text-sm text-muted-foreground">
              {data.talent?.current_position} {data.talent?.current_company && `• ${data.talent.current_company}`}
            </div>

            {Array.isArray(data.talent?.skills) && data.talent.skills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {(data.talent.skills as string[]).map((s) => (
                  <Badge key={s} variant="secondary">{s}</Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs">Etapa</Label>
                <Select value={data.stage} onValueChange={(v) => onStageChange(v as ApplicationStage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APPLICATION_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{APPLICATION_STAGE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">Avaliação (1-5)</Label>
                <Input
                  type="number" min={1} max={5}
                  value={rating}
                  onChange={(e) => setRating(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="rounded-md border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">Avaliação por IA</span>
                <Button size="sm" variant="outline" onClick={runAI} disabled={scoring}>
                  {scoring ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                  {data.ai_fit_score != null ? "Reavaliar" : "Avaliar"}
                </Button>
              </div>
              {data.ai_fit_score != null ? (
                <>
                  <p className="text-2xl font-semibold">{data.ai_fit_score}<span className="text-sm text-muted-foreground">/100</span></p>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{data.ai_fit_summary}</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Sem avaliação ainda.</p>
              )}
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Notas internas</Label>
              <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {data.stage === "rejected" && (
              <div className="grid gap-1.5">
                <Label className="text-xs">Motivo da reprovação</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={onSave} disabled={saving}>
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                Salvar alterações
              </Button>
              {data.stage !== "rejected" && (
                <Button variant="default" className="bg-emerald-600 hover:bg-emerald-700" onClick={onAdmit} disabled={admitting}>
                  {admitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserCheck className="mr-1 h-4 w-4" />}
                  Admitir 1-clique
                </Button>
              )}
              <Button variant="ghost" className="text-destructive" onClick={onDelete}>
                <Trash2 className="mr-1 h-4 w-4" />Remover
              </Button>
            </div>

            <Separator />
            <div>
              <h4 className="mb-2 text-sm font-medium">Histórico</h4>
              <ul className="space-y-2 text-xs">
                {(data.events ?? []).slice().reverse().map((ev) => (
                  <li key={ev.id} className="flex items-start gap-2 text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{ev.event_type}</span>
                    <span className="flex-1">
                      {ev.event_type === "stage_changed" && (
                        <>de <b>{APPLICATION_STAGE_LABEL[(ev.payload as any)?.from as ApplicationStage] ?? "—"}</b> para <b>{APPLICATION_STAGE_LABEL[(ev.payload as any)?.to as ApplicationStage] ?? "—"}</b></>
                      )}
                    </span>
                    <span>{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                  </li>
                ))}
                {(!data.events || data.events.length === 0) && <li className="text-muted-foreground">Sem eventos.</li>}
              </ul>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
