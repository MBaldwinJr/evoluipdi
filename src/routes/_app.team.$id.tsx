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
import { structureFeedback } from "@/server/ai.functions";
import { Badge } from "@/components/ui/badge";
import { InterviewWizard } from "@/components/interview-wizard";

export const Route = createFileRoute("/_app/team/$id")({ component: TeamMember });

function TeamMember() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: emp } = useQuery({
    queryKey: ["emp", id],
    queryFn: async () => (await supabase.from("employees").select("*, profile:profiles(full_name, email), role:roles_catalog(title)").eq("id", id).maybeSingle()).data,
  });
  const { data: feedbacks = [] } = useQuery({
    queryKey: ["emp-fb", id],
    queryFn: async () => (await supabase.from("feedbacks").select("*").eq("employee_id", id).order("occurred_at", { ascending: false })).data ?? [],
  });
  const { data: pdis = [] } = useQuery({
    queryKey: ["emp-pdis", id],
    queryFn: async () => (await supabase.from("pdis").select("*").eq("employee_id", id).order("created_at", { ascending: false })).data ?? [],
  });

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
          <TabsTrigger value="pdi">PDIs</TabsTrigger>
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
      </Tabs>
      <div className="mt-4"><Link to="/team" className="text-sm text-primary hover:underline">← Voltar para a equipe</Link></div>
    </>
  );
}
