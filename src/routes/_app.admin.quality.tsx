import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useOrg } from "@/lib/org-context";
import {
  qualityListOccurrences,
  qualityCreateOccurrence,
  qualityUpdateOccurrenceStatus,
  qualityStats,
  qualityInvestigate,
  type QualityAiInvestigation,
} from "@/lib/quality.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, ShieldCheck, ClipboardList, CheckCircle2, Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/quality")({ component: QualityPage });

const FormSchema = z.object({
  title: z.string().trim().min(3, "Mínimo 3 caracteres").max(200),
  description: z.string().trim().max(4000).optional(),
  category: z.string().trim().max(80).optional(),
  sector: z.string().trim().max(80).optional(),
  severity: z.enum(["baixa", "media", "alta", "critica"]),
});
type FormValues = z.infer<typeof FormSchema>;

const severityVariant: Record<string, string> = {
  baixa: "bg-muted text-foreground",
  media: "bg-yellow-500/15 text-yellow-700",
  alta: "bg-orange-500/15 text-orange-700",
  critica: "bg-red-500/15 text-red-700",
};
const statusLabel: Record<string, string> = {
  aberta: "Aberta",
  em_analise: "Em análise",
  em_acao: "Em ação",
  aguardando_aprovacao: "Aguardando aprovação",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

function QualityPage() {
  const { current } = useOrg();
  const orgId = current?.id;
  const qc = useQueryClient();
  const listFn = useServerFn(qualityListOccurrences);
  const statsFn = useServerFn(qualityStats);
  const createFn = useServerFn(qualityCreateOccurrence);
  const statusFn = useServerFn(qualityUpdateOccurrenceStatus);
  const [open, setOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["quality", "occurrences", orgId],
    queryFn: () => listFn({ data: { org_id: orgId! } }),
    enabled: !!orgId,
  });
  const { data: stats } = useQuery({
    queryKey: ["quality", "stats", orgId],
    queryFn: () => statsFn({ data: { org_id: orgId! } }),
    enabled: !!orgId,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { severity: "media" },
  });

  const create = useMutation({
    mutationFn: (v: FormValues) => createFn({ data: { org_id: orgId!, ...v } }),
    onSuccess: (row) => {
      toast.success(`Ocorrência ${row.code} criada`);
      setOpen(false);
      form.reset({ severity: "media" });
      qc.invalidateQueries({ queryKey: ["quality"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: (v: { id: string; status: FormValues["severity"] | string }) =>
      statusFn({ data: { id: v.id, org_id: orgId!, status: v.status as never } }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["quality"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!orgId) return <div className="p-6 text-muted-foreground">Selecione uma empresa.</div>;

  return (
    <div className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Gestão da Qualidade</h1>
          <p className="text-sm text-muted-foreground">Ocorrências, Ishikawa, 5 Porquês, CAPA e Auditorias ISO</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Nova ocorrência</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar ocorrência</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="space-y-3">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input id="title" {...form.register("title")} />
                {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Input id="category" {...form.register("category")} />
                </div>
                <div>
                  <Label htmlFor="sector">Setor</Label>
                  <Input id="sector" {...form.register("sector")} />
                </div>
              </div>
              <div>
                <Label>Gravidade</Label>
                <Select value={form.watch("severity")} onValueChange={(v) => form.setValue("severity", v as FormValues["severity"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea id="description" rows={4} {...form.register("description")} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={create.isPending}>{create.isPending ? "Salvando..." : "Salvar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={ClipboardList} label="Total" value={stats?.total ?? 0} />
        <KpiCard icon={AlertTriangle} label="Em aberto" value={stats?.abertas ?? 0} />
        <KpiCard icon={ShieldCheck} label="Críticas" value={stats?.criticas ?? 0} tone="danger" />
        <KpiCard icon={CheckCircle2} label="Concluídas" value={stats?.concluidas ?? 0} tone="success" />
      </div>

      <Card>
        <CardHeader><CardTitle>Ocorrências</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Código</th>
                    <th>Título</th>
                    <th>Setor</th>
                    <th>Gravidade</th>
                    <th>Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id} className="border-t">
                      <td className="py-2 font-mono text-xs">{it.code}</td>
                      <td className="font-medium">{it.title}</td>
                      <td className="text-muted-foreground">{it.sector ?? "—"}</td>
                      <td><Badge className={severityVariant[it.severity]}>{it.severity}</Badge></td>
                      <td>{statusLabel[it.status] ?? it.status}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <InvestigateButton occurrenceId={it.id} orgId={orgId} />
                          <Select
                            value={it.status}
                            onValueChange={(v) => changeStatus.mutate({ id: it.id, status: v })}
                          >
                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {Object.entries(statusLabel).map(([k, l]) => (
                                <SelectItem key={k} value={k}>{l}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "danger" | "success" }) {
  const color = tone === "danger" ? "text-red-600" : tone === "success" ? "text-emerald-600" : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-muted p-2"><Icon className={`h-5 w-5 ${color}`} /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-semibold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
