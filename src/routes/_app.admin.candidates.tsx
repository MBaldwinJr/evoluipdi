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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Copy, Eye, Sparkles, Loader2, Trash2, Link as LinkIcon, Printer, Upload, FileText, UserPlus, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { analyzeCandidateFn } from "@/lib/candidates.functions";
import { analyzeCandidateCvFn, getCandidateCvUrlFn, convertCandidateToEmployeeFn } from "@/lib/cv-analysis.functions";

export const Route = createFileRoute("/_app/admin/candidates")({ component: CandidatesPage });

const HIRE_LABEL: Record<string, { label: string; variant: any }> = {
  em_processo: { label: "Em processo", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  contratado: { label: "Contratado", variant: "default" },
  reprovado: { label: "Reprovado", variant: "destructive" },
  desistiu: { label: "Desistiu", variant: "outline" },
};

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
      .select("id, candidate_name, candidate_email, status, hire_status, created_at, submitted_at, analyzed_at, cv_uploaded_at, presential_done, token, role:roles_catalog(title)")
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
        description="Envie um link, receba currículo e respostas, analise com IA e converta em colaborador."
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
            const hs = HIRE_LABEL[c.hire_status] ?? { label: c.hire_status, variant: "secondary" };
            return (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{c.candidate_name}</CardTitle>
                      <p className="text-xs text-muted-foreground truncate">{c.candidate_email ?? "—"} · {c.role?.title}</p>
                    </div>
                    <Badge variant={hs.variant}>{hs.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    {c.cv_uploaded_at && <Badge variant="outline" className="text-[10px]"><FileText className="h-3 w-3 mr-1" /> CV</Badge>}
                    {c.presential_done && <Badge variant="outline" className="text-[10px]">Entrevista presencial</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Criado {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    {c.submitted_at && <> · Respondido {new Date(c.submitted_at).toLocaleDateString("pt-BR")}</>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyLink(c.token)}><LinkIcon className="mr-1 h-3 w-3" /> Link</Button>
                    <Button size="sm" variant="outline" onClick={() => setDetailId(c.id)}><Eye className="mr-1 h-3 w-3" /> Detalhes</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CandidateDetailDialog id={detailId} onClose={() => setDetailId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["candidate-invites"] })} isRH={isRH} />
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
      toast.success("Candidato criado — link copiado");
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

function CandidateDetailDialog({ id, onClose, onChanged, isRH }: { id: string | null; onClose: () => void; onChanged: () => void; isRH: boolean }) {
  const analyzeFn = useServerFn(analyzeCandidateFn);
  const analyzeCvFn = useServerFn(analyzeCandidateCvFn);
  const getCvUrl = useServerFn(getCandidateCvUrlFn);
  const [analysis, setAnalysis] = useState<any>(null);
  const [cvAnalysis, setCvAnalysis] = useState<any>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingCv, setLoadingCv] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["candidate-detail", id], enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("candidate_invites")
        .select("*, role:roles_catalog(id, title)")
        .eq("id", id!).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setAnalysis((data as any).analysis ?? null);
      setCvAnalysis((data as any).cv_analysis ?? null);
    }
  }, [data]);

  const close = () => { setAnalysis(null); setCvAnalysis(null); onClose(); };

  const runAnalysis = async () => {
    if (!id) return;
    setLoadingA(true);
    try {
      const res = await analyzeFn({ data: { inviteId: id, force: !!analysis } });
      setAnalysis(res); onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); } finally { setLoadingA(false); }
  };

  const runCvAnalysis = async () => {
    if (!id) return;
    setLoadingCv(true);
    try {
      const res = await analyzeCvFn({ data: { inviteId: id, force: !!cvAnalysis } });
      setCvAnalysis(res); onChanged(); refetch();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); } finally { setLoadingCv(false); }
  };

  const downloadCv = async () => {
    if (!id) return;
    try {
      const { url } = await getCvUrl({ data: { inviteId: id } });
      window.open(url, "_blank");
    } catch (e: any) { toast.error(e?.message ?? "Falha"); }
  };

  const uploadCv = async (file: File) => {
    if (!id || !data) return;
    if (file.size > 8 * 1024 * 1024) { toast.error("Arquivo maior que 8MB"); return; }
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
      const path = `${id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from("candidate-cvs").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      await supabase.from("candidate_invites").update({
        cv_path: path, cv_filename: safe, cv_uploaded_at: new Date().toISOString(), cv_analysis: null, cv_analyzed_at: null,
      }).eq("id", id);
      setCvAnalysis(null);
      toast.success("Currículo enviado");
      refetch(); onChanged();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); } finally { setUploading(false); }
  };

  const updateField = async (patch: Record<string, any>) => {
    if (!id) return;
    const { error } = await (supabase.from("candidate_invites") as any).update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { refetch(); onChanged(); }
  };

  return (
    <Dialog open={!!id} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent id="interview-print-area" className="max-w-3xl max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:max-w-full print:shadow-none">
        <DialogHeader><DialogTitle>{data?.candidate_name} — {(data as any)?.role?.title}</DialogTitle></DialogHeader>

        {isLoading || !data ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap print:hidden">
              <p className="text-xs text-muted-foreground">
                {data?.candidate_email ?? "—"} {data?.candidate_phone && `· ${data.candidate_phone}`}
                {data?.submitted_at && <> · Respondido em {new Date(data.submitted_at).toLocaleString("pt-BR")}</>}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-3 w-3" /> Imprimir</Button>
              </div>
            </div>

            {/* Pipeline */}
            <div className="rounded-md border p-3 grid gap-3 md:grid-cols-3 print:hidden">
              <div>
                <Label className="text-xs">Status de contratação</Label>
                <Select value={(data as any).hire_status} onValueChange={(v) => updateField({ hire_status: v, hired_at: v === "contratado" ? new Date().toISOString() : null })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(HIRE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Entrevista presencial realizada</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={!!(data as any).presential_done} onCheckedChange={(v) => updateField({ presential_done: v, presential_at: v ? new Date().toISOString() : null })} />
                  <span className="text-xs text-muted-foreground">
                    {(data as any).presential_at ? new Date((data as any).presential_at).toLocaleDateString("pt-BR") : "—"}
                  </span>
                </div>
              </div>
              <div>
                {isRH && (data as any).hire_status === "contratado" && !(data as any).hired_employee_id && (
                  <Button size="sm" className="w-full" onClick={() => setConvertOpen(true)}>
                    <UserPlus className="mr-1 h-3 w-3" /> Converter em colaborador
                  </Button>
                )}
                {(data as any).hired_employee_id && (
                  <Badge variant="default" className="w-full justify-center py-2">Colaborador criado</Badge>
                )}
              </div>
            </div>

            {(data as any).presential_done && (
              <div className="print:hidden">
                <Label className="text-xs">Observações da entrevista presencial</Label>
                <Textarea rows={3} defaultValue={(data as any).presential_notes ?? ""}
                  onBlur={(e) => { if (e.target.value !== ((data as any).presential_notes ?? "")) updateField({ presential_notes: e.target.value }); }} />
              </div>
            )}

            <Tabs defaultValue="answers">
              <TabsList className="print:hidden">
                <TabsTrigger value="answers">Respostas</TabsTrigger>
                <TabsTrigger value="cv">Currículo</TabsTrigger>
                <TabsTrigger value="analysis">Análise IA</TabsTrigger>
              </TabsList>

              <TabsContent value="answers" className="space-y-2">
                <div className="flex justify-end print:hidden">
                  <Button size="sm" onClick={runAnalysis} disabled={loadingA || !data?.answers}>
                    {loadingA ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                    {loadingA ? "Analisando…" : analysis ? "Reanalisar respostas" : "Analisar respostas"}
                  </Button>
                </div>
                {!data?.answers || (data.answers as any[]).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Candidato ainda não respondeu.</p>
                ) : (data.answers as any[]).map((a: any, i: number) => (
                  <div key={i} className="rounded-md border p-3 print-block">
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
              </TabsContent>

              <TabsContent value="cv" className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap print:hidden">
                  <Input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={uploading}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCv(f); }} className="max-w-xs" />
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {(data as any).cv_path && (
                    <>
                      <Button size="sm" variant="outline" onClick={downloadCv}><Download className="mr-1 h-3 w-3" /> Baixar</Button>
                      <Button size="sm" onClick={runCvAnalysis} disabled={loadingCv}>
                        {loadingCv ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                        {loadingCv ? "Analisando…" : cvAnalysis ? "Reanalisar CV" : "Analisar CV com IA"}
                      </Button>
                    </>
                  )}
                </div>
                {!(data as any).cv_path && <p className="text-sm text-muted-foreground">Nenhum currículo anexado. Envie pelo painel ou peça ao candidato pelo link.</p>}
                {(data as any).cv_filename && <p className="text-xs text-muted-foreground">{(data as any).cv_filename} · enviado {(data as any).cv_uploaded_at && new Date((data as any).cv_uploaded_at).toLocaleString("pt-BR")}</p>}

                {cvAnalysis && (
                  <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Análise do currículo</h3>
                      <Badge variant="outline" className="ml-auto">Fit: {cvAnalysis.fit_score}/100</Badge>
                      <Badge variant="outline">{cvAnalysis.experience_years} anos exp.</Badge>
                      <Badge variant={cvAnalysis.recommendation === "avancar" ? "default" : cvAnalysis.recommendation === "descartar" ? "destructive" : "secondary"}>
                        {cvAnalysis.recommendation}
                      </Badge>
                    </div>
                    <p className="text-sm">{cvAnalysis.summary}</p>
                    {cvAnalysis.highlights?.length > 0 && <Block title="Destaques" items={cvAnalysis.highlights} />}
                    {cvAnalysis.concerns?.length > 0 && <Block title="Alertas" items={cvAnalysis.concerns} />}
                    {cvAnalysis.questions_to_ask?.length > 0 && <Block title="Perguntas para aprofundar" items={cvAnalysis.questions_to_ask} ordered />}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="analysis" className="space-y-3">
                {!analysis && !cvAnalysis && <p className="text-sm text-muted-foreground">Rode a análise nas abas Respostas e Currículo.</p>}
                {analysis && (
                  <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Análise das respostas</h3>
                      <Badge variant="outline" className="ml-auto">Fit: {analysis.fit_score}/100</Badge>
                      <Badge variant={analysis.recommendation === "avancar" ? "default" : analysis.recommendation === "descartar" ? "destructive" : "secondary"}>
                        {analysis.recommendation}
                      </Badge>
                    </div>
                    <p className="text-sm">{analysis.summary}</p>
                    {analysis.strengths?.length > 0 && <Block title="Pontos fortes" items={analysis.strengths} />}
                    {analysis.concerns?.length > 0 && <Block title="Pontos de atenção" items={analysis.concerns} />}
                    {analysis.red_flags?.length > 0 && <Block title="Red flags" items={analysis.red_flags} danger />}
                    {analysis.interview_questions?.length > 0 && <Block title="Perguntas sugeridas" items={analysis.interview_questions} ordered />}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {convertOpen && id && data && (
          <ConvertDialog
            inviteId={id}
            defaults={{ fullName: data.candidate_name, email: data.candidate_email ?? "", roleId: (data as any).role?.id ?? null }}
            onClose={() => setConvertOpen(false)}
            onDone={() => { setConvertOpen(false); refetch(); onChanged(); }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Block({ title, items, ordered, danger }: { title: string; items: string[]; ordered?: boolean; danger?: boolean }) {
  return (
    <div>
      <p className={`text-xs font-semibold uppercase mb-1 ${danger ? "text-destructive" : "text-muted-foreground"}`}>{title}</p>
      {ordered
        ? <ol className="list-decimal pl-5 text-sm space-y-1">{items.map((s, i) => <li key={i} className={danger ? "text-destructive" : ""}>{s}</li>)}</ol>
        : <ul className="list-disc pl-5 text-sm space-y-1">{items.map((s, i) => <li key={i} className={danger ? "text-destructive" : ""}>{s}</li>)}</ul>}
    </div>
  );
}

function ConvertDialog({ inviteId, defaults, onClose, onDone }: { inviteId: string; defaults: { fullName: string; email: string; roleId: string | null }; onClose: () => void; onDone: () => void }) {
  const convert = useServerFn(convertCandidateToEmployeeFn);
  const [fullName, setFullName] = useState(defaults.fullName);
  const [email, setEmail] = useState(defaults.email);
  const [password, setPassword] = useState(() => Math.random().toString(36).slice(-10) + "A1");
  const [roleId, setRoleId] = useState<string>(defaults.roleId ?? "");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: roles = [] } = useQuery({ queryKey: ["roles-cat-conv"], queryFn: async () => (await supabase.from("roles_catalog").select("id, title").order("title")).data ?? [] });
  const { data: depts = [] } = useQuery({ queryKey: ["depts-conv"], queryFn: async () => (await supabase.from("departments").select("id, name").order("name")).data ?? [] });
  const { data: mgrs = [] } = useQuery({ queryKey: ["mgrs-conv"], queryFn: async () => (await supabase.rpc("list_team_directory")).data ?? [] });

  const submit = async () => {
    if (!fullName.trim() || !email.trim() || password.length < 6) { toast.error("Preencha nome, e-mail e senha (6+)"); return; }
    setSaving(true);
    try {
      await convert({ data: {
        inviteId, fullName: fullName.trim(), email: email.trim(), password,
        roleId: roleId || null, departmentId: departmentId || null, managerId: managerId || null,
      } });
      toast.success("Colaborador criado e candidato marcado como contratado");
      onDone();
    } catch (e: any) { toast.error(e?.message ?? "Falha"); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Converter em colaborador</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome completo *</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>E-mail *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <Label>Senha inicial *</Label>
              <div className="flex gap-1">
                <Input value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(password); toast.success("Copiada"); }}><Copy className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cargo</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Setor</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{depts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Gestor direto</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(mgrs as any[]).map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Criando…" : "Criar colaborador"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
