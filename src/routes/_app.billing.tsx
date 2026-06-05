import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useOrg } from "@/lib/org-context";
import { billingGetStatus, billingCreateCheckout, billingOpenPortal } from "@/lib/billing.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { CreditCard, Sparkles, AlertTriangle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/billing")({
  component: BillingPage,
});

function BillingPage() {
  const { current, isAdmin } = useOrg();
  const statusFn = useServerFn(billingGetStatus);
  const checkoutFn = useServerFn(billingCreateCheckout);
  const portalFn = useServerFn(billingOpenPortal);

  const { data, isLoading } = useQuery({
    queryKey: ["billing", current?.id],
    queryFn: () => statusFn({ data: { org_id: current!.id } }),
    enabled: !!current?.id,
  });

  const checkoutMut = useMutation({
    mutationFn: (plan_code: "starter" | "pro") => checkoutFn({ data: { org_id: current!.id, plan_code, interval: "month" } }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const portalMut = useMutation({
    mutationFn: () => portalFn({ data: { org_id: current!.id } }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (!isAdmin) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Apenas administradores podem gerenciar o plano e o pagamento.
      </Card>
    );
  }

  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Carregando faturamento...</p>;

  const pct = (used: number, limit: number) => (limit < 0 ? 0 : Math.min(100, Math.round((used / Math.max(1, limit)) * 100)));
  const fmt = (n: number) => (n < 0 ? "Ilimitado" : String(n));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturamento</h1>
        <p className="text-sm text-muted-foreground">Gerencie seu plano, pagamento e uso da plataforma.</p>
      </div>

      {data.is_in_trial && (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="font-medium">Você está no período de teste gratuito</p>
              <p className="text-sm text-muted-foreground">
                Faltam <strong>{data.trial_days_left} dia(s)</strong> para o fim do trial. Escolha um plano abaixo para continuar usando depois.
              </p>
            </div>
          </div>
        </Card>
      )}

      {data.is_expired && (
        <Card className="border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium">Seu período de teste expirou</p>
              <p className="text-sm text-muted-foreground">Assine um plano para reativar o acesso completo.</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano atual</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-2xl font-bold capitalize">{data.plan_code}</h2>
              {data.subscription ? (
                <Badge variant={data.subscription.status === "active" ? "default" : "secondary"}>{data.subscription.status}</Badge>
              ) : data.is_in_trial ? (
                <Badge variant="secondary">Trial</Badge>
              ) : null}
            </div>
            {data.subscription?.current_period_end && (
              <p className="mt-1 text-xs text-muted-foreground">
                Próxima cobrança: {new Date(data.subscription.current_period_end).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={() => portalMut.mutate()} disabled={portalMut.isPending}>
            <CreditCard className="mr-2 h-4 w-4" />
            Gerenciar pagamento
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold">Uso vs. limites do plano</h3>
        <div className="mt-4 space-y-4">
          <UsageRow label="Colaboradores" used={data.usage.employees} limit={data.limits.employees} pct={pct(data.usage.employees, data.limits.employees)} fmt={fmt} />
          <UsageRow label="Filiais" used={data.usage.branches} limit={data.limits.branches} pct={pct(data.usage.branches, data.limits.branches)} fmt={fmt} />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-semibold">Trocar de plano</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Veja todos os planos e comparativo completo em <Link to="/precos" className="text-primary hover:underline">/precos</Link>.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Button variant="outline" onClick={() => checkoutMut.mutate("starter")} disabled={checkoutMut.isPending}>
            Assinar Starter <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
          <Button onClick={() => checkoutMut.mutate("pro")} disabled={checkoutMut.isPending}>
            Assinar Pro <ExternalLink className="ml-2 h-3.5 w-3.5" />
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Para Enterprise ou pagamento via boleto/PIX, <Link to="/contato" className="text-primary hover:underline">fale com vendas</Link>.
        </p>
      </Card>
    </div>
  );
}

function UsageRow({ label, used, limit, pct, fmt }: { label: string; used: number; limit: number; pct: number; fmt: (n: number) => string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{used} / {fmt(limit)}</span>
      </div>
      <Progress value={pct} className="mt-1.5 h-2" />
    </div>
  );
}
