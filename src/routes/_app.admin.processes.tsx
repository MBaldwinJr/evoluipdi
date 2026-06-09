import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sparkles, Loader2, Pencil, Trash2, Plus, Printer, Building2, Search } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { generateProcessesFn, generateAllMissingProcessesFn, upsertProcessFn, deleteProcessFn, saveCompanySettingsFn } from "@/lib/processes.functions";
import { lookupCnpjFn } from "@/lib/cnpj.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/processes")({ component: ProcessesPage });

type Step = { title: string; how: string };

function ProcessesPage() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [selRole, setSelRole] = useState<string>("");
  const [genBusy, setGenBusy] = useState(false);
  const [genAllBusy, setGenAllBusy] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [roleSearch, setRoleSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [coverageFilter, setCoverageFilter] = useState("all");

  const generate = useServerFn(generateProcessesFn);
  const generateAll = useServerFn(generateAllMissingProcessesFn);
  const upsertFn = useServerFn(upsertProcessFn);
  const delFn = useServerFn(deleteProcessFn);
  const saveCompanyFn = useServerFn(saveCompanySettingsFn);

  const { data: company } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => (await supabase.from("company_settings").select("*").order("created_at", { ascending: true }).limit(1).maybeSingle()).data,
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles-with-counts"],
    queryFn: async () => {
      const { data: rs } = await supabase.from("roles_catalog").select("id, title, department_id, department:departments(id, name)").order("title");
      const { data: ps } = await supabase.from("role_processes").select("role_id");
      const counts = new Map<string, number>();
      (ps ?? []).forEach((p: any) => counts.set(p.role_id, (counts.get(p.role_id) ?? 0) + 1));
      return (rs ?? []).map((r: any) => ({ ...r, count: counts.get(r.id) ?? 0 }));
    },
  });
  const { data: processes = [] } = useQuery({
    queryKey: ["role-processes", selRole],
    enabled: !!selRole,
    queryFn: async () => (await supabase.from("role_processes").select("*").eq("role_id", selRole).order("sort_order")).data ?? [],
  });

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH." />;

  const handleGenerate = async (replace: boolean) => {
    if (!selRole) return toast.error("Selecione um cargo");
    setGenBusy(true);
    try {
      const r = await generate({ data: { roleId: selRole, replace } });
      toast.success(`${r.count} processos gerados`);
      qc.invalidateQueries({ queryKey: ["role-processes"] });
      qc.invalidateQueries({ queryKey: ["roles-with-counts"] });
    } catch (e: any) { toast.error(e.message); } finally { setGenBusy(false); }
  };
  const handleGenerateAll = async () => {
    setGenAllBusy(true);
    try {
      const r = (await generateAll()) as { processesCreated?: number; rolesProcessed?: number } | undefined;
      const created = r?.processesCreated ?? 0;
      const rolesDone = r?.rolesProcessed ?? 0;
      if (rolesDone === 0) toast.success("Nenhum cargo pendente — todos já possuem processos.");
      else toast.success(`${created} processos gerados em ${rolesDone} cargos`);
      qc.invalidateQueries({ queryKey: ["role-processes"] });
      qc.invalidateQueries({ queryKey: ["roles-with-counts"] });
    } catch (e: any) { toast.error(e.message); } finally { setGenAllBusy(false); }
  };
  const handleDelete = async (id: string) => {
    try {
      await delFn({ data: { id } });
      toast.success("Processo excluído");
      qc.invalidateQueries({ queryKey: ["role-processes"] });
      qc.invalidateQueries({ queryKey: ["roles-with-counts"] });
    } catch (e: any) { toast.error(e.message); }
  };

  const selectedRole = roles.find((r: any) => r.id === selRole);

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <PageHeader
        title="Processos por cargo"
        description="Manuais passo a passo (POPs) gerados a partir do CNAE da empresa e do RCF de cada cargo"
        action={
          <div className="flex gap-2 no-print">
            <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Building2 className="mr-2 h-4 w-4" />Dados da empresa</Button>
              </DialogTrigger>
              <CompanyDialog company={company} onSave={async (payload) => {
                try { await saveCompanyFn({ data: payload }); toast.success("Empresa atualizada"); qc.invalidateQueries({ queryKey: ["company-settings"] }); setCompanyOpen(false); }
                catch (e: any) { toast.error(e.message); }
              }} />
            </Dialog>
            <Button onClick={handleGenerateAll} disabled={genAllBusy} size="sm">
              {genAllBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Gerar para cargos sem processos
            </Button>
          </div>
        }
      />

      {!company?.cnae_code && (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:bg-amber-950/20 no-print">
          <CardContent className="pt-4 text-sm">
            <p className="font-medium">CNAE não configurado</p>
            <p className="text-muted-foreground">A IA usará "4744-0/05 — Comércio varejista de materiais de construção em geral" como padrão. Clique em <strong>Dados da empresa</strong> para personalizar.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="no-print h-fit">
          <CardHeader><CardTitle className="text-base">Cargos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input placeholder="Buscar cargo…" value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)} className="h-8" />
            <div className="flex gap-2">
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  <SelectItem value="_none">Sem setor</SelectItem>
                  {Array.from(new Map(roles.map((r: any) => r.department).filter((d: any) => d?.id).map((d: any) => [d.id, d])).values()).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={coverageFilter} onValueChange={setCoverageFilter}>
                <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Processos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="with">Com processos</SelectItem>
                  <SelectItem value="without">Sem processos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const q = roleSearch.trim().toLowerCase();
              const list = roles.filter((r: any) => {
                if (deptFilter === "_none" && r.department_id) return false;
                if (deptFilter !== "all" && deptFilter !== "_none" && r.department_id !== deptFilter) return false;
                if (coverageFilter === "with" && (r.count ?? 0) === 0) return false;
                if (coverageFilter === "without" && (r.count ?? 0) > 0) return false;
                if (q && !(r.title ?? "").toLowerCase().includes(q)) return false;
                return true;
              });
              if (roles.length === 0) return <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>;
              if (list.length === 0) return <p className="text-sm text-muted-foreground">Nenhum cargo encontrado.</p>;
              return list.map((r: any) => (
              <button key={r.id} onClick={() => setSelRole(r.id)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${selRole === r.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.department?.name ?? "—"}</p>
                  </div>
                  <Badge variant={r.count ? "default" : "outline"}>{r.count}</Badge>
                </div>
              </button>
            ));
            })()}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {!selRole && <EmptyState title="Selecione um cargo" description="Escolha um cargo à esquerda para visualizar ou gerar processos." />}
          {selRole && (
            <>
              <Card className="no-print">
                <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4">
                  <div>
                    <p className="text-sm font-medium">{selectedRole?.title}</p>
                    <p className="text-xs text-muted-foreground">{processes.length} processos</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimir / PDF</Button>
                    <ProcessEditor roleId={selRole} onSaved={() => { qc.invalidateQueries({ queryKey: ["role-processes"] }); qc.invalidateQueries({ queryKey: ["roles-with-counts"] }); }}>
                      <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Novo processo</Button>
                    </ProcessEditor>
                    <Button onClick={() => handleGenerate(false)} disabled={genBusy} size="sm" variant="outline">
                      {genBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Gerar com IA
                    </Button>
                    {processes.length > 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button size="sm" variant="destructive" disabled={genBusy}>Regerar (substitui)</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Substituir processos?</AlertDialogTitle>
                            <AlertDialogDescription>Todos os processos atuais deste cargo serão removidos e novos serão gerados pela IA.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleGenerate(true)}>Substituir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>

              {processes.length === 0 && <EmptyState title="Sem processos" description="Gere com IA ou crie manualmente." />}

              <Accordion type="multiple" className="space-y-2">
                {processes.map((p: any) => (
                  <AccordionItem key={p.id} value={p.id} className="rounded-md border bg-card">
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex flex-1 items-center justify-between gap-2 pr-2">
                        <span className="text-left text-sm font-medium">{p.title}</span>
                        <Badge variant="outline" className="shrink-0">{(p.steps ?? []).length} etapas</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3 px-4 pb-4">
                      {p.objective && <p className="text-sm"><strong>Objetivo: </strong>{p.objective}</p>}
                      {p.tools && <p className="text-sm text-muted-foreground"><strong>Ferramentas/insumos: </strong>{p.tools}</p>}
                      <ol className="space-y-2">
                        {(p.steps as Step[] ?? []).map((s, i) => (
                          <li key={i} className="rounded-md border bg-muted/30 p-3">
                            <p className="text-sm font-medium">{i + 1}. {s.title}</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{s.how}</p>
                          </li>
                        ))}
                      </ol>
                      {p.success_criteria && <p className="text-sm"><strong>Critério de sucesso: </strong>{p.success_criteria}</p>}
                      <div className="flex flex-wrap gap-2 no-print">
                        <Link to="/admin/process-flow/$processId" params={{ processId: p.id }}>
                          <Button variant="default" size="sm"><Sparkles className="mr-2 h-4 w-4" />Fluxograma</Button>
                        </Link>
                        <ProcessEditor roleId={selRole} existing={p} onSaved={() => qc.invalidateQueries({ queryKey: ["role-processes"] })}>
                          <Button variant="outline" size="sm"><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                        </ProcessEditor>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Excluir processo?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(p.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CompanyDialog({ company, onSave }: { company: any; onSave: (p: any) => void }) {
  const [legal, setLegal] = useState(company?.legal_name ?? "");
  const [trade, setTrade] = useState(company?.trade_name ?? "");
  const [cnpj, setCnpj] = useState(company?.cnpj ?? "");
  const [cnae, setCnae] = useState(company?.cnae_code ?? "4744-0/05");
  const [cnaeDesc, setCnaeDesc] = useState(company?.cnae_description ?? "Comércio varejista de materiais de construção em geral");
  const [segment, setSegment] = useState(company?.segment ?? "Materiais de construção (varejo)");
  const [notes, setNotes] = useState(company?.notes ?? "");
  const [lookingUp, setLookingUp] = useState(false);
  const lookup = useServerFn(lookupCnpjFn);

  const doLookup = async (value?: string) => {
    const v = (value ?? cnpj).replace(/\D/g, "");
    if (v.length !== 14) return toast.error("Informe um CNPJ com 14 dígitos");
    setLookingUp(true);
    try {
      const r = await lookup({ data: { cnpj: v } });
      if (r.legal_name) setLegal(r.legal_name);
      if (r.trade_name) setTrade(r.trade_name);
      if (r.cnae_code) setCnae(r.cnae_code);
      if (r.cnae_description) setCnaeDesc(r.cnae_description);
      if (r.segment) setSegment(r.segment);
      toast.success("Dados do CNPJ preenchidos");
    } catch (e: any) { toast.error(e.message); } finally { setLookingUp(false); }
  };

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Dados da empresa</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1">
          <Label>CNPJ</Label>
          <div className="flex gap-2">
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              onBlur={() => { const v = cnpj.replace(/\D/g, ""); if (v.length === 14) doLookup(v); }}
              placeholder="00.000.000/0000-00"
            />
            <Button type="button" variant="outline" onClick={() => doLookup()} disabled={lookingUp}>
              {lookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2">Buscar</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Os campos abaixo são preenchidos automaticamente a partir do CNPJ.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Razão social</Label><Input value={legal} onChange={(e) => setLegal(e.target.value)} /></div>
          <div className="space-y-1"><Label>Nome fantasia</Label><Input value={trade} onChange={(e) => setTrade(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>CNAE</Label><Input value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder="4744-0/05" /></div>
          <div className="space-y-1"><Label>Segmento</Label><Input value={segment} onChange={(e) => setSegment(e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label>Descrição do CNAE</Label><Input value={cnaeDesc} onChange={(e) => setCnaeDesc(e.target.value)} /></div>
        <div className="space-y-1"><Label>Observações (público-alvo, mix de produtos, particularidades)</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave({ id: company?.id, legal_name: legal, trade_name: trade, cnpj, cnae_code: cnae, cnae_description: cnaeDesc, segment, notes })}>Salvar</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ProcessEditor({ roleId, existing, onSaved, children }: { roleId: string; existing?: any; onSaved: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [objective, setObjective] = useState(existing?.objective ?? "");
  const [tools, setTools] = useState(existing?.tools ?? "");
  const [success, setSuccess] = useState(existing?.success_criteria ?? "");
  const [steps, setSteps] = useState<Step[]>(existing?.steps ?? [{ title: "", how: "" }]);
  const upsert = useServerFn(upsertProcessFn);

  const save = async () => {
    if (!title.trim()) return toast.error("Informe o título");
    try {
      await upsert({ data: { id: existing?.id, roleId, title, objective, tools, success_criteria: success, steps: steps.filter(s => s.title.trim() || s.how.trim()) } });
      toast.success("Processo salvo");
      onSaved();
      setOpen(false);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{existing ? "Editar processo" : "Novo processo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Objetivo</Label><Textarea rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></div>
          <div className="space-y-1"><Label>Ferramentas / insumos</Label><Textarea rows={2} value={tools} onChange={(e) => setTools(e.target.value)} /></div>
          <div className="space-y-1"><Label>Critério de sucesso</Label><Textarea rows={2} value={success} onChange={(e) => setSuccess(e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Etapas (como fazer)</Label>
            {steps.map((s, i) => (
              <div key={i} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Etapa {i + 1}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <Input placeholder="Título da etapa" value={s.title} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                <Textarea placeholder="Como fazer..." rows={3} value={s.how} onChange={(e) => setSteps(steps.map((x, j) => j === i ? { ...x, how: e.target.value } : x))} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSteps([...steps, { title: "", how: "" }])}><Plus className="mr-2 h-4 w-4" />Adicionar etapa</Button>
          </div>
        </div>
        <DialogFooter><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
