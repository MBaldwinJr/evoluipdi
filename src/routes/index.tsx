import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Users, Target, Clock, BarChart3, Sparkles, Briefcase, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Evolui — Gestão de Pessoas, Performance e Ponto" },
      { name: "description", content: "Plataforma brasileira de gestão de pessoas com PDI, feedbacks, processos por cargo, ponto eletrônico e IA. 14 dias grátis." },
      { property: "og:title", content: "Evolui — Gestão de Pessoas, Performance e Ponto" },
      { property: "og:description", content: "Tudo o que sua empresa precisa para desenvolver pessoas e cumprir a Portaria 671. Comece grátis em 2 minutos." },
      { property: "og:url", content: "https://evoluipdi.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://evoluipdi.lovable.app/" }],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <MarketingLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            Novo: Organograma editável e fluxograma de processos
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Gestão de pessoas que <span className="text-primary">acelera o crescimento</span> da sua empresa
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Cadastre colaboradores, defina cargos, aplique PDI, faça entrevistas, registre ponto e tome decisões com IA — tudo em uma plataforma adaptada ao seu segmento.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">Começar grátis por 14 dias</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/precos">Ver planos</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* Modules grid */}
      <section className="border-b py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold">Tudo o que o RH e os gestores precisam</h2>
            <p className="mt-3 text-muted-foreground">Módulos integrados que conversam entre si — sem planilhas, sem retrabalho.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <Card key={m.title} className="p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{m.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold">Adaptada ao seu negócio</h2>
              <p className="mt-3 text-muted-foreground">
                Detectamos automaticamente seu CNAE pela Receita Federal e configuramos a plataforma para o seu segmento — comércio, indústria, serviços ou tecnologia.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Cadastro instantâneo via CNPJ",
                  "Dados isolados por empresa (multi-tenant)",
                  "Conformidade com a Portaria 671 do MTE",
                  "Geofence e selfie no registro de ponto",
                  "Análises com IA (entrevistas, currículos, PDIs)",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <Card className="p-6">
              <p className="text-sm text-muted-foreground">Em 2 minutos você tem:</p>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">1</span>Conta criada com seu e-mail ou Google</li>
                <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">2</span>Empresa validada pelo CNPJ na Receita</li>
                <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">3</span>Colaboradores cadastrados e convidados</li>
                <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">4</span>Primeiro ponto batido e PDI iniciado</li>
              </ul>
              <Button asChild className="mt-6 w-full">
                <Link to="/login">Começar agora</Link>
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-bold">Pronto para evoluir sua gestão de pessoas?</h2>
          <p className="mt-3 text-muted-foreground">14 dias grátis. Sem cartão. Sem compromisso.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/login">Criar conta grátis</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/contato">Falar com vendas</Link></Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

const MODULES = [
  { title: "Colaboradores & Organograma", description: "Cadastre pessoas, departamentos e gerentes. Desenhe a hierarquia visualmente.", icon: Users },
  { title: "PDI & Feedbacks", description: "Planos de desenvolvimento individual com gaps, ações e check-ins.", icon: Target },
  { title: "Cargos & Processos", description: "Defina cargos, RCFs e fluxogramas de processos por função.", icon: Briefcase },
  { title: "Entrevistas & Candidatos", description: "Roteiros estruturados, pré-entrevistas com link e análise por IA.", icon: MessageSquare },
  { title: "Ponto Eletrônico", description: "Geofence, selfie, escalas, espelho do mês e detecção de anomalias.", icon: Clock },
  { title: "Relatórios & IA", description: "Indicadores de performance, distribuição por nível e insights automáticos.", icon: BarChart3 },
];
