import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Evolui" },
      { name: "description", content: "Planos do Evolui: Free, Starter, Pro e Enterprise. Comece grátis por 14 dias e escolha o plano ideal para o tamanho da sua empresa." },
      { property: "og:title", content: "Preços — Evolui" },
      { property: "og:description", content: "Planos a partir de R$ 0/mês. 14 dias grátis em qualquer plano." },
      { property: "og:url", content: "https://evoluipdi.lovable.app/precos" },
    ],
    links: [{ rel: "canonical", href: "https://evoluipdi.lovable.app/precos" }],
  }),
  component: PricingPage,
});

const PLANS = [
  {
    code: "free",
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    description: "Para testar a plataforma com uma equipe pequena.",
    features: ["Até 5 colaboradores", "1 filial", "Módulo de RH básico", "Suporte por e-mail"],
    cta: "Começar grátis",
    highlight: false,
  },
  {
    code: "starter",
    name: "Starter",
    price: "R$ 197",
    period: "/mês",
    description: "Para empresas iniciando estruturação de RH.",
    features: ["Até 25 colaboradores", "3 filiais", "RH + PDI + Entrevistas", "Relatórios essenciais", "Suporte por chat"],
    cta: "Assinar Starter",
    highlight: false,
  },
  {
    code: "pro",
    name: "Pro",
    price: "R$ 497",
    period: "/mês",
    description: "Para empresas em crescimento com gestão completa.",
    features: ["Até 100 colaboradores", "10 filiais", "Todos os módulos exceto IA avançada", "Ponto eletrônico completo", "Candidatos & pré-entrevistas", "Suporte prioritário"],
    cta: "Assinar Pro",
    highlight: true,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para grandes operações com necessidades específicas.",
    features: ["Colaboradores ilimitados", "Filiais ilimitadas", "IA avançada + jornada avançada", "SLA e onboarding dedicado", "Integrações personalizadas", "Customer Success dedicado"],
    cta: "Falar com vendas",
    highlight: false,
  },
];

function PricingPage() {
  return (
    <MarketingLayout>
      <section className="border-b py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-4xl font-bold md:text-5xl">Planos que crescem com você</h1>
          <p className="mt-4 text-muted-foreground">14 dias grátis em qualquer plano. Sem cartão de crédito para começar.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <Card key={p.code} className={`flex flex-col p-6 ${p.highlight ? "border-primary shadow-lg" : ""}`}>
                {p.highlight && (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">Mais popular</span>
                )}
                <h3 className="text-xl font-bold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6" variant={p.highlight ? "default" : "outline"}>
                  <Link to={p.code === "enterprise" ? "/contato" : "/login"}>{p.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            Precisa de algo customizado? <Link to="/contato" className="text-primary hover:underline">Fale com a gente</Link>.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
