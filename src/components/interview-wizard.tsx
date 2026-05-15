import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Save, CheckCircle2 } from "lucide-react";

type Kind = "selecao" | "feedback" | "desligamento" | "carreira" | "inicial" | "periodica" | "avaliacao";

const KIND_LABEL: Record<string, string> = {
  selecao: "Seleção", feedback: "Feedback", desligamento: "Desligamento",
  carreira: "Carreira", inicial: "Inicial", periodica: "Periódica", avaliacao: "Avaliação",
};

const MIN_ANSWER = 3;

export function InterviewWizard({
  open, onOpenChange, employeeId, roleId, employeeName, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  roleId: string | null;
  employeeName: string;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [kind, setKind] = useState<Kind>("feedback");

  const { data: templates = [] } = useQuery({
    queryKey: ["int-tpl", roleId, kind],
    enabled: open && !!roleId,
    queryFn: async () => (await supabase.from("interview_templates").select("id, title, questions").eq("role_id", roleId!).eq("kind", kind)).data ?? [],
  });

  const template = templates[0] as any;
  const questions: string[] = useMemo(() => {
    if (!Array.isArray(template?.questions)) return [];
    return template.questions.map((q: any) =>
      typeof q === "string" ? q : (q?.question ?? q?.text ?? String(q ?? ""))
    );
  }, [template]);
  const draftKey = template ? `interview-draft:${employeeId}:${template.id}` : "";

  const [answers, setAnswers] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Load draft when template changes
  useEffect(() => {
    if (!template) { setAnswers([]); setStep(0); setNotes(""); return; }
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const d = JSON.parse(raw);
        setAnswers(d.answers ?? Array(questions.length).fill(""));
        setStep(d.step ?? 0);
        setNotes(d.notes ?? "");
        return;
      }
    } catch {}
    setAnswers(Array(questions.length).fill(""));
    setStep(0);
    setNotes("");
  }, [template?.id, questions.length]);

  // Auto-save draft
  useEffect(() => {
    if (!draftKey || !template) return;
    const t = setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify({ answers, step, notes, savedAt: Date.now() }));
    }, 400);
    return () => clearTimeout(t);
  }, [answers, step, notes, draftKey, template]);

  const total = questions.length;
  const answered = answers.filter((a) => a && a.trim().length >= MIN_ANSWER).length;
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
  const currentAnswer = answers[step] ?? "";
  const canAdvance = currentAnswer.trim().length >= MIN_ANSWER;

  const updateAnswer = (v: string) => {
    setAnswers((prev) => { const c = [...prev]; c[step] = v; return c; });
  };

  const finish = async () => {
    if (!user) return;
    if (answered < total) {
      const missing = total - answered;
      if (!confirm(`Faltam ${missing} resposta(s). Salvar mesmo assim?`)) return;
    }
    setSaving(true);
    try {
      const { data: itv, error } = await supabase.from("interviews").insert({
        employee_id: employeeId, conducted_by: user.id, kind, template_id: template.id, notes,
      }).select("id").single();
      if (error) throw error;
      const rows = questions.map((q, i) => ({ interview_id: itv.id, question: q, answer: answers[i] ?? "" }));
      if (rows.length) {
        const { error: e2 } = await supabase.from("interview_answers").insert(rows);
        if (e2) throw e2;
      }
      localStorage.removeItem(draftKey);
      toast.success("Entrevista registrada");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const saveDraft = () => {
    if (!draftKey) return;
    localStorage.setItem(draftKey, JSON.stringify({ answers, step, notes, savedAt: Date.now() }));
    toast.success("Rascunho salvo localmente");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar entrevista — {employeeName}</DialogTitle>
        </DialogHeader>

        {!roleId ? (
          <p className="text-sm text-muted-foreground">Este colaborador ainda não tem cargo. Defina o cargo antes de aplicar uma entrevista.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label>Tipo de entrevista</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="selecao">Seleção</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                    <SelectItem value="desligamento">Desligamento</SelectItem>
                    <SelectItem value="carreira">Carreira</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {template && (
                <Badge variant="secondary" className="mb-2">{answered}/{total} respondidas</Badge>
              )}
            </div>

            {!template ? (
              <p className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
                Nenhum roteiro encontrado para {KIND_LABEL[kind]} neste cargo. Cadastre em "Roteiros de entrevista".
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Pergunta {step + 1} de {total}</span>
                    <span>{progress}% concluído</span>
                  </div>
                  <Progress value={progress} />
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium leading-relaxed">{questions[step]}</p>
                  <Textarea
                    rows={5}
                    value={currentAnswer}
                    onChange={(e) => updateAnswer(e.target.value)}
                    placeholder="Digite a resposta do colaborador..."
                  />
                  {!canAdvance && currentAnswer.length > 0 && (
                    <p className="text-xs text-destructive">Resposta muito curta (mínimo {MIN_ANSWER} caracteres).</p>
                  )}
                </div>

                {step === total - 1 && (
                  <div className="space-y-1">
                    <Label>Observações finais (opcional)</Label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Resumo, percepções, próximos passos..." />
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={saveDraft}>
                    <Save className="mr-1 h-3 w-3" /> Salvar rascunho
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                      <ArrowLeft className="mr-1 h-3 w-3" /> Anterior
                    </Button>
                    {step < total - 1 ? (
                      <Button size="sm" disabled={!canAdvance} onClick={() => setStep((s) => Math.min(total - 1, s + 1))}>
                        Próxima <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    ) : (
                      <Button size="sm" disabled={saving} onClick={finish}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> {saving ? "Salvando..." : "Finalizar"}
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
