import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { platformListOrgs, platformSetOrgStatus, platformSetPlan, ALL_MODULES, PLAN_MODULES } from "@/lib/platform.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Shield, Pause, Play, Settings2, LogIn } from "lucide-react";

export const Route = createFileRoute("/_app/platform")({
  component: PlatformPage,
});

function PlatformPage() {
  const { isSuperAdmin } = useAuth();
  const listFn = useServerFn(platformListOrgs);
  const setStatusFn = useServerFn(platformSetOrgStatus);
  const qc = useQueryClient();

  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform", "orgs"],
    queryFn: () => listFn(),
    enabled: isSuperAdmin,
  });

  const toggleStatus = useMutation({
    mutationFn: (vars: { org_id: string; status: "active" | "suspended" }) => setStatusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["platform", "orgs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto max-w-md text-center text-muted-foreground">
        <Shield className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        Acesso restrito a administradores da plataforma.
      </div>
    );
  }

  const filtered = (data ?? []).filter((o: any) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      o.legal_name?.toLowerCase().includes(s) ||
      o.trade_name?.toLowerCase().includes(s) ||
      o.cnpj?.includes(s)
    );
  });

  const impersonate = (orgId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("active_org_id", orgId);
      window.location.href = "/me";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Plataforma</h1>
          <p className="text-sm text-muted-foreground">Gerencie todas as empresas que utilizam o sistema</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Empresas</CardTitle>
              <CardDescription>{(data ?? []).length} empresa(s) cadastrada(s)</CardDescription>
            </div>
            <Input
              placeholder="Buscar por nome ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((o: any) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{o.trade_name || o.legal_name}</span>
                      <Badge variant={o.status === "active" ? "default" : "destructive"}>{o.status}</Badge>
                      <Badge variant="outline">{o.plan_code}</Badge>
                      {o.subscription_status && <Badge variant="secondary">{o.subscription_status}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {o.cnpj && <>CNPJ {o.cnpj} · </>}
                      {o.members_count} usuário(s) ·
                      Trial até {o.trial_ends_at ? new Date(o.trial_ends_at).toLocaleDateString("pt-BR") : "—"}
                    </div>
                  </div>
                  <PlanDialog org={o} />
                  <Button
                    size="sm"
                    variant={o.status === "active" ? "outline" : "default"}
                    onClick={() => toggleStatus.mutate({ org_id: o.id, status: o.status === "active" ? "suspended" : "active" })}
                  >
                    {o.status === "active" ? (<><Pause className="mr-1 h-3 w-3" />Suspender</>) : (<><Play className="mr-1 h-3 w-3" />Reativar</>)}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => impersonate(o.id)}>
                    <LogIn className="mr-1 h-3 w-3" />Entrar
                  </Button>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">Nenhuma empresa encontrada</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PlanDialog({ org }: { org: any }) {
  const setPlanFn = useServerFn(platformSetPlan);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<"free" | "starter" | "pro" | "enterprise">(org.plan_code);
  const [modules, setModules] = useState<string[]>(org.modules ?? PLAN_MODULES[org.plan_code] ?? []);

  const save = useMutation({
    mutationFn: () => setPlanFn({ data: { org_id: org.id, plan_code: plan, modules } }),
    onSuccess: () => {
      toast.success("Plano atualizado");
      qc.invalidateQueries({ queryKey: ["platform", "orgs"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleModule = (m: string) =>
    setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const applyPlanDefault = (p: typeof plan) => {
    setPlan(p);
    setModules(PLAN_MODULES[p] ?? []);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Settings2 className="mr-1 h-3 w-3" />Plano</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{org.trade_name || org.legal_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Plano</label>
            <Select value={plan} onValueChange={(v) => applyPlanDefault(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="starter">Starter</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Módulos habilitados</label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_MODULES.map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm">
                  <Checkbox checked={modules.includes(m)} onCheckedChange={() => toggleModule(m)} />
                  {m}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
