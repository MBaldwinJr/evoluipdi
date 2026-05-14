import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { suggestPdiActions, suggestGapsFromEmployee } from "@/lib/ai.functions";

export const Route = createFileRoute("/_app/me/pdi")({
  component: MyPdiPage,
});

function MyPdiPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: emp } = useQuery({
    queryKey: ["me-emp", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("employees").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: pdis = [] } = useQuery({
    queryKey: ["me-pdis", emp?.id], enabled: !!emp,
    queryFn: async () => (await supabase.from("pdis").select(`*, points:pdi_development_points(*, actions:pdi_actions(*))`).eq("employee_id", emp!.id).order("created_at", { ascending: false })).data ?? [],
  });

  if (!emp) {
    return (
      <>
        <PageHeader title="Meu PDI" />
        <EmptyState title="Cadastro pendente" description="Procure o RH para concluir seu cadastro de colaborador antes de criar um PDI." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Meu PDI"
        description="Plano de Desenvolvimento Individual em 4 etapas: objetivo → gaps → pontos de desenvolvimento → ações 70-20-10"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo PDI</Button></DialogTrigger>
            <NewPdiDialog employeeId={emp.id} onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["me-pdis"] }); }} />
          </Dialog>
        }
      />

      {pdis.length === 0 ? (
        <EmptyState title="Nenhum PDI ainda" description="Crie seu primeiro PDI definindo um objetivo claro de desenvolvimento." />
      ) : (
        <div className="space-y-6">
          {pdis.map((p: any) => <PdiCard key={p.id} pdi={p} employeeId={emp.id} />)}
        </div>
      )}
    </>
  );
}

function NewPdiDialog({ employeeId, onCreated }: { employeeId: string; onCreated: () => void }) {
  const [objective, setObjective] = useState("");
  const [horizon, setHorizon] = useState<"curto" | "medio" | "longo">("medio");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!objective.trim()) return toast.error("Defina um objetivo");
    setBusy(true);
    const { error } = await supabase.from("pdis").insert({ employee_id: employeeId, objective, horizon, status: "rascunho" });
    setBusy(false);
    if (error) return toast.error("Erro ao criar PDI", { description: error.message });
    toast.success("PDI criado");
    onCreated();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Etapa 1 — Definir objetivo</DialogTitle>
        <DialogDescription>Descreva o que você quer alcançar e em que horizonte.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Objetivo</Label>
          <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex.: Tornar-me referência em arquitetura de soluções no setor de engenharia." rows={4} />
        </div>
        <div className="space-y-2">
          <Label>Horizonte</Label>
          <Select value={horizon} onValueChange={(v: any) => setHorizon(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="curto">Curto prazo (até 3 meses)</SelectItem>
              <SelectItem value="medio">Médio prazo (3 a 12 meses)</SelectItem>
              <SelectItem value="longo">Longo prazo (1 ano+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Criando..." : "Criar PDI"}</Button></DialogFooter>
    </DialogContent>
  );
}

function PdiCard({ pdi, employeeId }: { pdi: any; employeeId: string }) {
  const qc = useQueryClient();
  const [pointDesc, setPointDesc] = useState("");
  const [criteria, setCriteria] = useState("");
  const [busyAi, setBusyAi] = useState<string | null>(null);

  const allActions = pdi.points?.flatMap((p: any) => p.actions ?? []) ?? [];
  const done = allActions.filter((a: any) => a.status === "concluida").length;
  const progress = allActions.length ? Math.round((done / allActions.length) * 100) : 0;
  const cat = (c: string) => allActions.filter((a: any) => a.category === c).length;
  const total = allActions.length || 1;
  const pPratica = Math.round((cat("pratica") / total) * 100);
  const pTroca = Math.round((cat("troca") / total) * 100);
  const pFormal = Math.round((cat("formal") / total) * 100);

  const addPoint = async () => {
    if (!pointDesc.trim()) return;
    const { error } = await supabase.from("pdi_development_points").insert({ pdi_id: pdi.id, description: pointDesc, success_criteria: criteria });
    if (error) return toast.error(error.message);
    setPointDesc(""); setCriteria("");
    qc.invalidateQueries({ queryKey: ["me-pdis"] });
  };

  const submitForReview = async () => {
    const { error } = await supabase.from("pdis").update({ status: "aguardando_validacao" }).eq("id", pdi.id);
    if (error) return toast.error(error.message);
    toast.success("Enviado ao gestor para validação");
    qc.invalidateQueries({ queryKey: ["me-pdis"] });
  };

  const aiSuggestActions = async (pointId: string, pointDesc: string) => {
    setBusyAi(pointId);
    try {
      const result = await suggestPdiActions({ data: { developmentPoint: pointDesc } });
      const rows = result.actions.map((a: any) => ({ development_point_id: pointId, category: a.category, description: a.description }));
      const { error } = await supabase.from("pdi_actions").insert(rows);
      if (error) throw error;
      toast.success("Ações sugeridas pela IA adicionadas");
      qc.invalidateQueries({ queryKey: ["me-pdis"] });
    } catch (e: any) {
      toast.error("Erro de IA", { description: e.message });
    } finally { setBusyAi(null); }
  };

  const aiSuggestGaps = async () => {
    setBusyAi("gaps");
    try {
      const result = await suggestGapsFromEmployee({ data: { employeeId } });
      const rows = result.gaps.map((g: any) => ({ employee_id: employeeId, title: g.title, severity: g.severity, justification: g.justification, root_cause: g.root_cause, source: "IA" }));
      if (rows.length) await supabase.from("gaps").insert(rows);
      toast.success(`${rows.length} gap(s) sugerido(s)`);
    } catch (e: any) {
      toast.error("Erro de IA", { description: e.message });
    } finally { setBusyAi(null); }
  };

  const toggleAction = async (a: any) => {
    const next = a.status === "concluida" ? "pendente" : "concluida";
    await supabase.from("pdi_actions").update({ status: next, completed_at: next === "concluida" ? new Date().toISOString() : null }).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["me-pdis"] });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{pdi.objective}</CardTitle>
            <CardDescription className="mt-1 flex flex-wrap gap-2">
              <Badge variant="secondary">{horizonLabel(pdi.horizon)}</Badge>
              <Badge>{statusLabel(pdi.status)}</Badge>
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={aiSuggestGaps} disabled={busyAi === "gaps"}><Sparkles className="mr-1 h-3 w-3" />Sugerir gaps</Button>
            {pdi.status === "rascunho" && <Button size="sm" onClick={submitForReview}>Enviar p/ gestor</Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Progresso</span><span>{progress}%</span></div>
          <Progress value={progress} />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Distribuição 70-20-10</p>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div className="bg-chart-1" style={{ width: `${pPratica}%` }} title={`Prática ${pPratica}%`} />
            <div className="bg-chart-2" style={{ width: `${pTroca}%` }} title={`Troca ${pTroca}%`} />
            <div className="bg-chart-4" style={{ width: `${pFormal}%` }} title={`Formal ${pFormal}%`} />
          </div>
          <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
            <span>● Prática {pPratica}%</span><span>● Troca {pTroca}%</span><span>● Formal {pFormal}%</span>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Pontos de desenvolvimento</h4>
          {(pdi.points ?? []).map((pt: any) => (
            <div key={pt.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{pt.description}</p>
                  {pt.success_criteria && <p className="text-xs text-muted-foreground">Critério: {pt.success_criteria}</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => aiSuggestActions(pt.id, pt.description)} disabled={busyAi === pt.id}>
                  <Sparkles className="mr-1 h-3 w-3" />{busyAi === pt.id ? "..." : "Ações 70-20-10"}
                </Button>
              </div>
              {pt.actions?.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {pt.actions.map((a: any) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      <button onClick={() => toggleAction(a)} className="text-muted-foreground hover:text-success">
                        <CheckCircle2 className={`h-4 w-4 ${a.status === "concluida" ? "text-success" : ""}`} />
                      </button>
                      <Badge variant="outline" className="text-xs">{categoryLabel(a.category)}</Badge>
                      <span className={a.status === "concluida" ? "text-muted-foreground line-through" : ""}>{a.description}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Input placeholder="Novo ponto de desenvolvimento (ex.: Aprofundar conhecimento em arquitetura limpa)" value={pointDesc} onChange={(e) => setPointDesc(e.target.value)} />
            <Input placeholder="Critério de sucesso (ex.: Liderar 1 refatoração de módulo crítico)" value={criteria} onChange={(e) => setCriteria(e.target.value)} />
            <Button size="sm" onClick={addPoint}><Plus className="mr-1 h-3 w-3" />Adicionar ponto</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function statusLabel(s: string) { return ({ rascunho: "Rascunho", aguardando_validacao: "Aguardando validação", aprovado: "Aprovado", em_andamento: "Em andamento", concluido: "Concluído", cancelado: "Cancelado" } as any)[s] ?? s; }
function horizonLabel(h: string) { return ({ curto: "Curto prazo", medio: "Médio prazo", longo: "Longo prazo" } as any)[h] ?? h; }
function categoryLabel(c: string) { return ({ pratica: "70 · Prática", troca: "20 · Troca", formal: "10 · Formal" } as any)[c] ?? c; }
