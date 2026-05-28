import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ptListMyCompanies, ptCreateCompany } from "@/lib/pt.functions";
import { PtCompanyProvider, usePtCompany } from "@/lib/pt-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/pt")({
  component: PtLayout,
});

function PtLayout() {
  const listFn = useServerFn(ptListMyCompanies);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pt", "my-companies"],
    queryFn: () => listFn(),
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando empresas...</div>;

  const companies = (data ?? []).map((c: any) => ({
    id: c.id, legal_name: c.legal_name, trade_name: c.trade_name, role: c.role,
    block_outside_geofence: c.block_outside_geofence,
  }));

  if (companies.length === 0) {
    return <OnboardingCreate onCreated={() => refetch()} />;
  }

  return (
    <PtCompanyProvider initialCompanies={companies}>
      <PtChrome onRefresh={() => refetch()} />
    </PtCompanyProvider>
  );
}

const NAV = [
  { to: "/pt", label: "Bater ponto", exact: true },
  { to: "/pt/espelho", label: "Espelho" },
  { to: "/pt/funcionarios", label: "Funcionários", role: ["admin", "rh"] },
  { to: "/pt/filiais", label: "Filiais", role: ["admin", "rh"] },
  { to: "/pt/escalas", label: "Escalas", role: ["admin", "rh"] },
  { to: "/pt/dashboard", label: "Dashboard", role: ["admin", "rh", "gestor", "supervisor", "auditor"] },
];

function PtChrome({ onRefresh }: { onRefresh: () => void }) {
  const { companies, current, setCurrent } = usePtCompany();
  const path = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold">Ponto</h1>
          <Select value={current?.id ?? ""} onValueChange={setCurrent}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.trade_name || c.legal_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CreateCompanyButton onCreated={onRefresh} />
      </div>

      <nav className="flex flex-wrap gap-1 border-b">
        {NAV.filter((n) => !n.role || (current && n.role.includes(current.role))).map((n) => {
          const active = n.exact ? path === n.to : path === n.to || path.startsWith(n.to + "/");
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`px-3 py-2 text-sm border-b-2 -mb-px transition ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}

function CreateCompanyButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [legal, setLegal] = useState("");
  const [trade, setTrade] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const createFn = useServerFn(ptCreateCompany);

  const submit = async () => {
    if (!legal.trim()) return;
    setLoading(true);
    try {
      await createFn({ data: { legal_name: legal, trade_name: trade || undefined, cnpj: cnpj || undefined, timezone: "America/Sao_Paulo", block_outside_geofence: false } });
      toast.success("Empresa criada");
      setOpen(false); setLegal(""); setTrade(""); setCnpj("");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="mr-1 h-4 w-4" />Nova empresa</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Razão social *</Label><Input value={legal} onChange={(e) => setLegal(e.target.value)} /></div>
          <div><Label>Nome fantasia</Label><Input value={trade} onChange={(e) => setTrade(e.target.value)} /></div>
          <div><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading || !legal.trim()}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingCreate({ onCreated }: { onCreated: () => void }) {
  return (
    <div className="max-w-md mx-auto mt-12 space-y-4 text-center">
      <Clock className="h-12 w-12 mx-auto text-primary" />
      <h2 className="text-2xl font-semibold">Bem-vindo ao módulo Ponto</h2>
      <p className="text-muted-foreground">Crie sua primeira empresa para começar a gerenciar jornadas, filiais e batidas.</p>
      <CreateCompanyButton onCreated={onCreated} />
    </div>
  );
}
