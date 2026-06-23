import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { orgLookupCnpj, orgCreateFromCnpj } from "@/lib/org.functions";
import { Building2, Search, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const lookupFn = useServerFn(orgLookupCnpj);
  const createFn = useServerFn(orgCreateFromCnpj);
  const [cnpj, setCnpj] = useState("");
  const [lookup, setLookup] = useState<any>(null);
  const [plan, setPlan] = useState<"free" | "starter" | "pro" | "enterprise">("pro");
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    setLoading(true);
    try {
      const res = await lookupFn({ data: { cnpj } });
      setLookup(res);
      toast.success("CNPJ validado na Receita Federal");
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await createFn({ data: { cnpj, plan_code: plan, payload: lookup?.payload } });
      if (typeof window !== "undefined") localStorage.setItem("active_org_id", res.id);
      toast.success("Empresa cadastrada com sucesso");
      window.location.href = "/me";
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2"><Building2 className="h-6 w-6 text-primary" /></div>
            <div>
              <CardTitle>Cadastre sua empresa</CardTitle>
              <CardDescription>Informe o CNPJ — validamos automaticamente na Receita Federal</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label>CNPJ</Label>
              <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <Button onClick={handleLookup} disabled={loading || cnpj.replace(/\D/g, "").length !== 14} className="mt-6">
              <Search className="mr-1 h-4 w-4" />Validar
            </Button>
          </div>

          {lookup && (
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <CheckCircle2 className="h-4 w-4" />Empresa encontrada
              </div>
              <div className="text-sm"><strong>Razão social:</strong> {lookup.legal_name}</div>
              {lookup.trade_name && <div className="text-sm"><strong>Nome fantasia:</strong> {lookup.trade_name}</div>}
              {lookup.cnae_description && <div className="text-sm"><strong>CNAE:</strong> {lookup.cnae_code} — {lookup.cnae_description}</div>}
            </div>
          )}

          {lookup && (
            <div>
              <Label>Plano</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {(["free", "starter", "pro", "enterprise"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlan(p)}
                    className={`rounded-md border p-3 text-sm capitalize transition ${plan === p ? "border-primary bg-primary/10 font-medium" : "hover:border-muted-foreground"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {plan === "free" && "RH básico"}
                {plan === "starter" && "RH + PDI + Entrevistas + Relatórios"}
                {plan === "pro" && "+ Candidatos + Ponto (recomendado)"}
                {plan === "enterprise" && "Tudo + Jornada avançada + IA"}
              </p>
            </div>
          )}

          <Button onClick={handleCreate} disabled={loading || !lookup} className="w-full">
            Criar empresa e começar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
