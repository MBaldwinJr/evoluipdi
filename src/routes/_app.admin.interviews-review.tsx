import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, Loader2, Eye, Plus, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { analyzeInterviewFn } from "@/lib/interview-analysis.functions";

export const Route = createFileRoute("/_app/admin/interviews-review")({ component: ReviewInterviews });

const KIND_LABEL: Record<string, string> = {
  selecao: "Seleção", feedback: "Feedback", desligamento: "Desligamento", carreira: "Carreira",
  inicial: "Inicial", periodica: "Periódica", avaliacao: "Avaliação",
};

function ReviewInterviews() {
  const { isRH, isGestor } = useAuth();
  const qc = useQueryClient();
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ["applied-interviews"],
    queryFn: async () => (await supabase
      .from("interviews")
      .select("id, kind, occurred_at, notes, overall_level, employee:employees(id, profile:profiles(full_name, email), role:roles_catalog(title))")
      .order("occurred_at", { ascending: false })
      .limit(200)).data ?? [],
  });

  if (!isRH && !isGestor) return <EmptyState title="Acesso restrito" description="Apenas RH ou gestores." />;

  const filtered = interviews.filter((i: any) => kindFilter === "all" || i.kind === kindFilter);

  return (
    <>
      <PageHeader
        title="Entrevistas aplicadas"
        description="Revise entrevistas registradas e gere análises com IA."
        action={
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhuma entrevista" description="Aplique entrevistas a partir da página da equipe." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((i: any) => (
            <Card key={i.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{i.employee?.profile?.full_name ?? i.employee?.profile?.email ?? "—"}</CardTitle>
                    <p className="text-xs text-muted-foreground truncate">{i.employee?.role?.title ?? "Sem cargo"}</p>
                  </div>
                  <Badge variant="secondary">{KIND_LABEL[i.kind] ?? i.kind}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {new Date(i.occurred_at).toLocaleString("pt-BR")}
                  {i.overall_level && <> · Nível: <span className="font-medium">{i.overall_level}</span></>}
                </p>
                {i.notes && <p className="text-sm line-clamp-2">{i.notes}</p>}
                <Button size="sm" variant="outline" onClick={() => setOpenId(i.id)}>
                  <Eye className="mr-1 h-3 w-3" /> Ver e analisar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <InterviewDetailDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["applied-interviews"] })} />
    </>
  );
}

function InterviewDetailDialog({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const analyzeFn = useServerFn(analyzeInterviewFn);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["interview-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const [{ data: itv }, { data: ans }] = await Promise.all([
        supabase.from("interviews").select("*, employee:employees(id, profile:profiles(full_name))").eq("id", id!).maybeSingle(),
        supabase.from("interview_answers").select("question, answer").eq("interview_id", id!).order("created_at"),
      ]);
      if ((itv as any)?.analysis) setAnalysis((itv as any).analysis);
      return { itv, ans: ans ?? [] };
    },
  });

  const close = () => { setAnalysis(null); onClose(); };

  const runAnalysis = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await analyzeFn({ data: { interviewId: id } });
      setAnalysis(res);
    } catch (e: any) { toast.error(e?.message ?? "Falha na análise"); } finally { setLoading(false); }
  };

  const convertGapsToPdi = async () => {
    if (!analysis?.suggested_gaps?.length || !data?.itv?.employee?.id || !user) return;
    try {
      const empId = data.itv.employee.id;
      const rows = analysis.suggested_gaps.map((g: any) => ({
        employee_id: empId, title: g.title, severity: g.severity, justification: g.justification, source: "entrevista",
      }));
      const { error } = await supabase.from("gaps").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} gap(s) adicionados ao colaborador`);
      onChanged();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={!!id} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent id="interview-print-area" className="max-w-3xl max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:max-w-full print:shadow-none">
        <DialogHeader>
          <DialogTitle>Entrevista — {data?.itv?.employee?.profile?.full_name ?? ""}</DialogTitle>
        </DialogHeader>

        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 print:hidden">
              <p className="text-xs text-muted-foreground">
                {KIND_LABEL[data?.itv?.kind ?? ""] ?? data?.itv?.kind} · {data?.itv?.occurred_at ? new Date(data.itv.occurred_at).toLocaleString("pt-BR") : ""}
                {(data?.itv as any)?.analyzed_at && <> · Analisada em {new Date((data!.itv as any).analyzed_at).toLocaleString("pt-BR")}</>}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-1 h-3 w-3" /> Imprimir / Salvar
                </Button>
                <Button size="sm" onClick={runAnalysis} disabled={loading}>
                  {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                  {loading ? "Analisando…" : analysis ? "Reanalisar com IA" : "Analisar com IA"}
                </Button>
              </div>
            </div>
            <p className="hidden print:block text-xs">
              {KIND_LABEL[data?.itv?.kind ?? ""] ?? data?.itv?.kind} · {data?.itv?.occurred_at ? new Date(data.itv.occurred_at).toLocaleString("pt-BR") : ""}
            </p>


            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Perguntas e respostas</h3>
              {data?.ans?.length === 0 && <p className="text-sm text-muted-foreground">Sem respostas registradas.</p>}
              {data?.ans?.map((a: any, i: number) => (
                <div key={i} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{i + 1}. {a.question}</p>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.answer || "—"}</p>
                </div>
              ))}
              {data?.itv?.notes && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Observações</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{data.itv.notes}</p>
                </div>
              )}
            </div>

            {analysis && (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Análise da IA</h3>
                  <Badge variant="outline" className="ml-auto">Nível sugerido: {analysis.overall_level_suggestion}</Badge>
                </div>
                <p className="text-sm">{analysis.summary}</p>

                {analysis.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Pontos fortes</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">{analysis.strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.concerns?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Atenção</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">{analysis.concerns.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.signals?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Sinais por pergunta</p>
                    <div className="space-y-1">
                      {analysis.signals.map((s: any, i: number) => (
                        <div key={i} className="text-sm">
                          <Badge variant={s.sentiment === "atencao" ? "destructive" : s.sentiment === "positivo" ? "default" : "secondary"} className="mr-2">{s.sentiment}</Badge>
                          <span className="font-medium">{s.question}</span> — <span className="text-muted-foreground">{s.insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.next_steps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Próximos passos</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">{analysis.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.suggested_gaps?.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Gaps sugeridos</p>
                      <Button size="sm" variant="outline" onClick={convertGapsToPdi}>
                        <Plus className="mr-1 h-3 w-3" /> Adicionar como gaps
                      </Button>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {analysis.suggested_gaps.map((g: any, i: number) => (
                        <li key={i} className="rounded border p-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{g.severity}</Badge>
                            <span className="font-medium">{g.title}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{g.justification}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
