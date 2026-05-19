import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, X, Maximize2, Check, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { generateMissingTemplatesFn } from "@/lib/template-coverage.functions";

export const Route = createFileRoute("/_app/admin/interviews")({ component: AdminInterviews });

const KINDS = [
  { value: "selecao", label: "Seleção" },
  { value: "feedback", label: "Feedback" },
  { value: "desligamento", label: "Desligamento" },
  { value: "carreira", label: "Carreira" },
];

function AdminInterviews() {
  const { isRH } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [expanded, setExpanded] = useState<any>(null);

  const { data: roles = [] } = useQuery({ queryKey: ["roles-cat"], queryFn: async () => (await supabase.from("roles_catalog").select("id, title")).data ?? [] });
  const { data: templates = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => (await supabase.from("interview_templates").select("*, role:roles_catalog(title)").order("created_at", { ascending: false })).data ?? [],
  });

  if (!isRH) return <EmptyState title="Acesso restrito" description="Apenas RH." />;

  const remove = async (id: string) => {
    const { error } = await supabase.from("interview_templates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Roteiro removido");
    qc.invalidateQueries({ queryKey: ["templates"] });
  };

  return (
    <>
      <PageHeader title="Roteiros de entrevista" description="Crie roteiros por cargo e tipo" action={
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="mr-2 h-4 w-4" />Novo roteiro</Button></DialogTrigger>
          <TemplateDialog
            roles={roles}
            template={editing}
            onSaved={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["templates"] }); }}
          />
        </Dialog>
      } />

      {templates.length === 0 ? (
        <EmptyState title="Nenhum roteiro criado" description="Crie seu primeiro roteiro de entrevista." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t: any) => {
            const qs = Array.isArray(t.questions) ? t.questions : [];
            return (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{t.title}</CardTitle>
                      <div className="mt-1 flex gap-2">
                        <Badge variant="secondary">{KINDS.find(k => k.value === t.kind)?.label ?? t.kind}</Badge>
                        {t.role?.title && <Badge variant="outline">{t.role.title}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Expandir e editar perguntas" onClick={() => setExpanded(t)}>
                        <Maximize2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(t); setOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir "{t.title}"?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => remove(t.id)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-2">{qs.length} pergunta(s)</p>
                  <ol className="list-decimal pl-5 text-sm space-y-1">
                    {qs.slice(0, 4).map((q: any, i: number) => <li key={i}>{typeof q === "string" ? q : q.question}</li>)}
                    {qs.length > 4 && <li className="list-none text-muted-foreground">+ {qs.length - 4} mais…</li>}
                  </ol>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ExpandedQuestionsDialog
        template={expanded}
        onClose={() => setExpanded(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["templates"] })}
      />
    </>
  );
}

function ExpandedQuestionsDialog({ template, onClose, onSaved }: { template: any; onClose: () => void; onSaved: () => void }) {
  const questions: string[] = Array.isArray(template?.questions)
    ? template.questions.map((q: any) => (typeof q === "string" ? q : q?.question ?? ""))
    : [];
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const persist = async (next: string[]) => {
    setBusy(true);
    try {
      const payload = next.map((q) => ({ question: q }));
      const { error } = await supabase.from("interview_templates").update({ questions: payload }).eq("id", template.id);
      if (error) throw error;
      toast.success("Pergunta atualizada");
      onSaved();
      template.questions = payload;
      setEditIdx(null);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const saveOne = async (i: number) => {
    if (!draft.trim()) return toast.error("Pergunta não pode ficar vazia");
    const next = questions.map((q, idx) => (idx === i ? draft.trim() : q));
    await persist(next);
  };

  const removeOne = async (i: number) => {
    const next = questions.filter((_, idx) => idx !== i);
    await persist(next);
  };

  return (
    <Dialog open={!!template} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
          {questions.length === 0 && <p className="text-sm text-muted-foreground">Sem perguntas.</p>}
          {questions.map((q, i) => (
            <div key={i} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground mt-1">#{i + 1}</span>
                {editIdx === i ? (
                  <div className="flex-1 space-y-2">
                    <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[80px]" />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditIdx(null)} disabled={busy}>Cancelar</Button>
                      <Button size="sm" onClick={() => saveOne(i)} disabled={busy}>
                        <Check className="mr-1 h-3 w-3" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-sm leading-relaxed">{q}</p>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditIdx(i); setDraft(q); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeOne(i)} disabled={busy}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({ roles, template, onSaved }: { roles: any[]; template: any; onSaved: () => void }) {
  const isEdit = !!template;
  const [title, setTitle] = useState(template?.title ?? "");
  const [kind, setKind] = useState(template?.kind ?? "feedback");
  const [roleId, setRoleId] = useState(template?.role_id ?? "");
  const [questions, setQuestions] = useState<string[]>(() => {
    const qs = template?.questions;
    if (!Array.isArray(qs)) return [""];
    return qs.map((q: any) => (typeof q === "string" ? q : q.question ?? "")).filter(Boolean);
  });
  const [busy, setBusy] = useState(false);

  const updateQ = (i: number, v: string) => setQuestions(qs => qs.map((q, idx) => idx === i ? v : q));
  const addQ = () => setQuestions(qs => [...qs, ""]);
  const delQ = (i: number) => setQuestions(qs => qs.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!title.trim()) return toast.error("Informe o título");
    const cleaned = questions.map(q => q.trim()).filter(Boolean);
    if (cleaned.length === 0) return toast.error("Adicione ao menos uma pergunta");
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        kind: kind as any,
        role_id: roleId || null,
        questions: cleaned.map(q => ({ question: q })),
      };
      const { error } = isEdit
        ? await supabase.from("interview_templates").update(payload).eq("id", template.id)
        : await supabase.from("interview_templates").insert(payload);
      if (error) throw error;
      toast.success(isEdit ? "Roteiro atualizado" : "Roteiro criado");
      onSaved();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{isEdit ? "Editar roteiro" : "Novo roteiro"}</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
        <div className="space-y-1"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1"><Label>Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Cargo (opcional)</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue placeholder="Genérico" /></SelectTrigger>
              <SelectContent>{roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Perguntas</Label>
          {questions.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Textarea value={q} onChange={(e) => updateQ(i, e.target.value)} placeholder={`Pergunta ${i + 1}`} className="min-h-[60px]" />
              <Button size="icon" variant="ghost" onClick={() => delQ(i)} disabled={questions.length === 1}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={addQ}><Plus className="mr-2 h-4 w-4" />Adicionar pergunta</Button>
        </div>
      </div>
      <DialogFooter><Button onClick={submit} disabled={busy}>{busy ? "Salvando..." : "Salvar"}</Button></DialogFooter>
    </DialogContent>
  );
}
