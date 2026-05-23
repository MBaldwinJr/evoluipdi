import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { structureFeedback } from "@/lib/ai.functions";
import { Badge } from "@/components/ui/badge";
import { InterviewWizard } from "@/components/interview-wizard";

export const Route = createFileRoute("/_app/team/$id")({ component: TeamMember });

function TeamMember() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: emp } = useQuery({
    queryKey: ["emp", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_employee_basic", { _employee_id: id });
      const row: any = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        ...row,
        profile: { full_name: row.full_name },
        role: { id: row.role_id, title: row.role_title },
      };
    },
  });
  const { data: feedbacks = [] } = useQuery({
    queryKey: ["emp-fb", id],
    queryFn: async () => (await supabase.from("feedbacks").select("*").eq("employee_id", id).order("occurred_at", { ascending: false })).data ?? [],
  });
  const { data: pdis = [] } = useQuery({
    queryKey: ["emp-pdis", id],
    queryFn: async () => (await supabase.from("pdis").select("*").eq("employee_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: interviews = [] } = useQuery({
    queryKey: ["emp-int", id],
    queryFn: async () => (await supabase.from("interviews").select("id, kind, occurred_at, notes, template:interview_templates(title)").eq("employee_id", id).order("occurred_at", { ascending: false })).data ?? [],
  });
  const { data: gaps = [] } = useQuery({
    queryKey: ["emp-gaps", id],
    queryFn: async () => (await supabase.from("gaps").select("*").eq("employee_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const toggleGapResolved = async (gapId: string, resolved: boolean) => {
    const { error } = await supabase.from("gaps").update({ resolved: !resolved }).eq("id", gapId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["emp-gaps", id] });
  };
  const deleteGap = async (gapId: string) => {
    if (!confirm("Excluir este gap?")) return;
    const { error } = await supabase.from("gaps").delete().eq("id", gapId);
    if (error) return toast.error(error.message);
    toast.success("Gap excluído");
    qc.invalidateQueries({ queryKey: ["emp-gaps", id] });
  };
  const [wizardOpen, setWizardOpen] = useState(false);

  const [raw, setRaw] = useState("");
  const [fact, setFact] = useState(""); const [impact, setImpact] = useState(""); const [next, setNext] = useState("");
  const [kind, setKind] = useState<"informal"|"formal">("informal");
  const [busy, setBusy] = useState(false);

  const aiStructure = async () => {
    if (!raw.trim()) return;
    setBusy(true);
    try {
      const r = await structureFeedback({ data: { rawText: raw } });
      setFact(r.fact); setImpact(r.impact); setNext(r.next_step);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!fact.trim()) return toast.error("Informe ao menos o fato");
    const { error } = await supabase.from("feedbacks").insert({ employee_id: id, author_id: user!.id, kind, fact, impact, next_step: next });
    if (error) return toast.error(error.message);
    toast.success("Feedback registrado");
    setRaw(""); setFact(""); setImpact(""); setNext("");
    qc.invalidateQueries({ queryKey: ["emp-fb", id] });
  };

  const validatePdi = async (pdiId: string, status: "aprovado"|"em_andamento") => {
    const { error } = await supabase.from("pdis").update({ status, validated_by: user!.id, validated_at: new Date().toISOString() }).eq("id", pdiId);
    if (error) return toast.error(error.message);
    toast.success("PDI atualizado");
    qc.invalidateQueries({ queryKey: ["emp-pdis", id] });
  };

  if (!emp) return <EmptyState title="Colaborador não encontrado" description="Verifique o link." />;

  return (
    <>
      <PageHeader title={(emp as any).profile?.full_name || (emp as any).profile?.email || "Colaborador"} description={(emp as any).role?.title ?? "Sem cargo"} />
      <Tabs defaultValue="feedback">
        <TabsList>
          <TabsTrigger value="feedback">Dar feedback</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="gaps">Gaps ({gaps.filter((g:any)=>!g.resolved).length})</TabsTrigger>
          <TabsTrigger value="pdi">PDIs</TabsTrigger>
          <TabsTrigger value="entrevistas">Entrevistas</TabsTrigger>
        </TabsList>

        <TabsContent value="feedback">
          <Card><CardHeader><CardTitle className="text-base">Novo feedback</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Texto bruto (opcional — IA estrutura para você)</Label>
                <Textarea rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Escreva como você falaria..." />
                <Button size="sm" variant="outline" onClick={aiStructure} disabled={busy}><Sparkles className="mr-1 h-3 w-3" />{busy ? "..." : "Estruturar com IA"}</Button>
              </div>
              <div className="space-y-2"><Label>Fato observado</Label><Textarea rows={2} value={fact} onChange={(e)=>setFact(e.target.value)} /></div>
              <div className="space-y-2"><Label>Impacto</Label><Textarea rows={2} value={impact} onChange={(e)=>setImpact(e.target.value)} /></div>
              <div className="space-y-2"><Label>Próximo passo</Label><Textarea rows={2} value={next} onChange={(e)=>setNext(e.target.value)} /></div>
              <div className="space-y-2"><Label>Tipo</Label>
                <Select value={kind} onValueChange={(v: any)=>setKind(v)}>
                  <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="informal">Informal</SelectItem><SelectItem value="formal">Formal</SelectItem></SelectContent>
                </Select>
              </div>
              <Button onClick={submit}>Registrar feedback</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          {feedbacks.length === 0 ? <EmptyState title="Sem histórico" description="Nenhum feedback registrado ainda." /> : (
            <div className="space-y-3">
              {feedbacks.map((f: any) => (
                <Card key={f.id}><CardContent className="pt-6 space-y-1">
                  <div className="flex gap-2"><Badge variant={f.kind === "formal" ? "default" : "secondary"}>{f.kind}</Badge>
                    <span className="text-xs text-muted-foreground">{new Date(f.occurred_at).toLocaleDateString("pt-BR")}</span></div>
                  <p className="text-sm"><strong>Fato:</strong> {f.fact}</p>
                  {f.impact && <p className="text-sm"><strong>Impacto:</strong> {f.impact}</p>}
                  {f.next_step && <p className="text-sm"><strong>Próximo:</strong> {f.next_step}</p>}
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gaps">
          {gaps.length === 0 ? <EmptyState title="Sem gaps" description="Nenhum gap registrado. Aplique uma entrevista e analise com IA para gerar gaps automaticamente." /> : (
            <div className="space-y-2">
              {gaps.map((g: any) => (
                <Card key={g.id} className={g.resolved ? "opacity-60" : ""}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={g.severity === "alta" ? "destructive" : g.severity === "media" ? "default" : "secondary"}>{g.severity}</Badge>
                        {g.source && <Badge variant="outline">{g.source}</Badge>}
                        <span className="font-medium text-sm">{g.title}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleGapResolved(g.id, g.resolved)}>{g.resolved ? "Reabrir" : "Resolver"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteGap(g.id)}>Excluir</Button>
                      </div>
                    </div>
                    {g.justification && <p className="text-xs text-muted-foreground"><strong>Justificativa:</strong> {g.justification}</p>}
                    {g.root_cause && <p className="text-xs text-muted-foreground"><strong>Causa-raiz:</strong> {g.root_cause}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(g.created_at).toLocaleDateString("pt-BR")}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pdi">
          {pdis.length === 0 ? <EmptyState title="Sem PDIs" description="O colaborador ainda não criou um PDI." /> : (
            <div className="space-y-3">
              {pdis.map((p: any) => (
                <Card key={p.id}><CardContent className="pt-6 space-y-2">
                  <p className="font-medium">{p.objective}</p>
                  <Badge>{p.status}</Badge>
                  {p.status === "aguardando_validacao" && (
                    <div className="flex gap-2"><Button size="sm" onClick={()=>validatePdi(p.id, "aprovado")}>Aprovar</Button>
                      <Button size="sm" variant="outline" onClick={()=>validatePdi(p.id, "em_andamento")}>Aprovar e iniciar</Button></div>
                  )}
                </CardContent></Card>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="entrevistas">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><ListChecks className="h-4 w-4" />Entrevistas aplicadas</CardTitle>
              <Button size="sm" onClick={() => setWizardOpen(true)}><Plus className="mr-1 h-3 w-3" />Nova entrevista</Button>
            </CardHeader>
            <CardContent>
              {interviews.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma entrevista registrada. Clique em "Nova entrevista" para iniciar o wizard.</p>
              ) : (
                <div className="space-y-2">
                  {interviews.map((it: any) => (
                    <div key={it.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{it.kind}</Badge>
                          <span className="text-sm font-medium">{it.template?.title ?? "Entrevista"}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(it.occurred_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      {it.notes && <p className="mt-2 text-sm text-muted-foreground">{it.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <InterviewWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        employeeId={id}
        roleId={(emp as any).role?.id ?? null}
        employeeName={(emp as any).profile?.full_name || (emp as any).profile?.email || "Colaborador"}
        onSaved={() => qc.invalidateQueries({ queryKey: ["emp-int", id] })}
      />
      <div className="mt-4"><Link to="/team" className="text-sm text-primary hover:underline">← Voltar para a equipe</Link></div>
    </>
  );
}
