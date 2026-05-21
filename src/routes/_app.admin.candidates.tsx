import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Copy, Eye, Sparkles, Loader2, Trash2, Link as LinkIcon, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { analyzeCandidateFn } from "@/lib/candidates.functions";

export const Route = createFileRoute("/_app/admin/candidates")({ component: CandidatesPage });

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  pendente: { label: "Aguardando resposta", variant: "secondary" },
  respondido: { label: "Respondido", variant: "default" },
  analisado: { label: "Analisado", variant: "default" },
  descartado: { label: "Descartado", variant: "outline" },
};

function CandidatesPage() {
  const { isRH, isGestor, user } = useAuth();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["candidate-invites"],
    queryFn: async () => (await supabase
      .from("candidate_invites")
      .select("id, candidate_name, candidate_email, status, created_at, submitted_at, analyzed_at, token, role:roles_catalog(title)")
      .order("created_at", { ascending: false })).data ?? [],
  });

  if (!isRH && !isGestor) return <EmptyState title="Acesso restrito" description="Apenas RH ou gestores." />;

  const remove = async (id: string) => {
    if (!confirm("Excluir este convite?")) return;
    const { error } = await supabase.from("candidate_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Convite removido");
    qc.invalidateQueries({ queryKey: ["candidate-invites"] });
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/candidato/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  return (
    <>
      <PageHeader
        title="Candidatos / Pré-entrevistas"
        description="Envie um link para o candidato responder o roteiro de seleção antes da entrevista presencial."
        action={
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> Novo candidato</Button></DialogTrigger>
            <NewCandidateDialog onClose={() => setOpenNew(false)} userId={user?.id} onCreated={() => qc.invalidateQueries({ queryKey: ["candidate-invites"] })} />
          </Dialog>
        }
      />

      {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
       list.length === 0 ? <EmptyState title="Nenhum candidato" description="Crie um convite para começar." /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((c: any) => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, variant: "secondary" };
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{c.candidate_name}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{c.candidate_email ?? "—"} · {c.role?.title}</p>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Criado {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    {c.submitted_at && <> · Respondido {new Date(c.submitted_at).toLocaleDateString("pt-BR")}</>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLink(c.token)}><LinkIcon className="mr-1 h-3 w-3" /> Copiar link</Button>
                    <Button size="sm" variant="outline" onClick={() => setDetailId(c.id)} disabled={c.status === "pendente"}>
                      <Eye className="mr-1 h-3 w-3" /> Ver e analisar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CandidateDetailDialog id={detailId} onClose={() => setDetailId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["candidate-invites"] })} />
    </>
  );
}

function NewCandidateDialog({ onClose, userId, onCreated }: { onClose: () => void; userId?: string; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [days, setDays] = useState("14");
  const [saving, setSaving] = useState(false);

  const { data: roles = [] } = useQuery({ queryKey: ["roles-cat-sel"], queryFn: async () => (await supabase.from("roles_catalog").select("id, title").order("title")).data ?? [] });
  const { data: tpl } = useQuery({
    queryKey: ["selecao-tpl", roleId], enabled: !!roleId,
    queryFn: async () => (await supabase.from("interview_templates").select("id, title, questions").eq("role_id", roleId).eq("kind", "selecao").maybeSingle()).data,
  });

  const create = async () => {
    if (!name.trim() || !roleId || !userId) { toast.error("Preencha nome e cargo"); return; }
    if (!tpl) { toast.error("Este cargo não tem roteiro de seleção. Gere o roteiro em 'Roteiros de entrevista'."); return; }
    setSaving(true);
    try {
      const expires_at = days ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null;
      const { data, error } = await supabase.from("candidate_invites").insert({
        candidate_name: name.trim(), candidate_email: email.trim() || null, candidate_phone: phone.trim() || null,
        role_id: roleId, template_id: tpl.id, created_by: userId, expires_at,
      }).select("token").single();
      if (error) throw error;
      const url = `${window.location.origin}/candidato/${data.token}`;
      navigator.clipboard.writeText(url);
      toast.success("Candidato criado — link copiado para a área de transferência");
      onCreated();
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Novo candidato</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nome completo *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        </div>
        <div>
          <Label>Cargo *</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
            <SelectContent>{roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
          </Select>
          {roleId && !tpl && <p className="text-xs text-destructive mt-1">Este cargo não tem roteiro de seleção. Gere em "Roteiros de entrevista".</p>}
          {tpl && <p className="text-xs text-muted-foreground mt-1">Roteiro: <span className="font-medium">{tpl.title}</span> · {(tpl.questions as any[])?.length ?? 0} perguntas</p>}
        </div>
        <div>
          <Label>Validade do link (dias)</Label>
          <Input type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={create} disabled={saving}>{saving ? "Criando…" : "Criar e copiar link"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CandidateDetailDialog({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const analyzeFn = useServerFn(analyzeCandidateFn);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-detail", id], enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("candidate_invites")
        .select("*, role:roles_catalog(title)")
        .eq("id", id!).maybeSingle();
      if ((data as any)?.analysis) setAnalysis((data as any).analysis);
      return data;
    },
  });

  const close = () => { setAnalysis(null); onClose(); };

  const runAnalysis = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await analyzeFn({ data: { inviteId: id, force: !!analysis } });
      setAnalysis(res);
      onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Falha na análise"); } finally { setLoading(false); }
  };

  return (
    <Dialog open={!!id} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent id="interview-print-area" className="max-w-3xl max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:max-w-full print:shadow-none">
        <DialogHeader><DialogTitle>{data?.candidate_name} — {data?.role?.title}</DialogTitle></DialogHeader>

        {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 print:hidden">
              <p className="text-xs text-muted-foreground">
                {data?.candidate_email ?? "—"} {data?.candidate_phone && `· ${data.candidate_phone}`}
                {data?.submitted_at && <> · Respondido em {new Date(data.submitted_at).toLocaleString("pt-BR")}</>}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-3 w-3" /> Imprimir</Button>
                <Button size="sm" onClick={runAnalysis} disabled={loading || !data?.answers}>
                  {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                  {loading ? "Analisando…" : analysis ? "Reanalisar" : "Analisar com IA"}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Respostas do candidato</h3>
              {!data?.answers || (data.answers as any[]).length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem respostas.</p>
              ) : (data.answers as any[]).map((a: any, i: number) => (
                <div key={i} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{i + 1}. {a.question}</p>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.answer || "—"}</p>
                </div>
              ))}
              {data?.notes && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Considerações do candidato</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{data.notes}</p>
                </div>
              )}
            </div>

            {analysis && (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Análise do perfil</h3>
                  <Badge variant="outline" className="ml-auto">Fit: {analysis.fit_score}/100</Badge>
                  <Badge variant={analysis.recommendation === "avancar" ? "default" : analysis.recommendation === "descartar" ? "destructive" : "secondary"}>
                    {analysis.recommendation === "avancar" ? "Avançar" : analysis.recommendation === "descartar" ? "Descartar" : "Considerar"}
                  </Badge>
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
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Pontos de atenção</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">{analysis.concerns.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.red_flags?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-destructive mb-1">Red flags</p>
                    <ul className="list-disc pl-5 text-sm space-y-1 text-destructive">{analysis.red_flags.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.rcf_alignment?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Aderência ao RCF</p>
                    <div className="space-y-1">
                      {analysis.rcf_alignment.map((s: any, i: number) => (
                        <div key={i} className="text-sm rounded border p-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={s.level === "supera" ? "default" : s.level === "abaixo" ? "destructive" : "secondary"}>{s.level}</Badge>
                            <span className="font-medium">{s.competency}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{s.evidence}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.interview_questions?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Perguntas sugeridas para a entrevista presencial</p>
                    <ul className="list-decimal pl-5 text-sm space-y-1">{analysis.interview_questions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {analysis.next_steps?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Próximos passos</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">{analysis.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
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
