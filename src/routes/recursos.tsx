import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/recursos")({
  head: () => ({
    meta: [
      { title: "Recursos — Evolui" },
      { name: "description", content: "Conheça em detalhes os módulos do Evolui: RH, PDI, Entrevistas, Candidatos, Ponto Eletrônico, Relatórios e IA." },
      { property: "og:title", content: "Recursos — Evolui" },
      { property: "og:description", content: "Tudo sobre os módulos de gestão de pessoas e ponto eletrônico do Evolui." },
      { property: "og:url", content: "https://evoluipdi.lovable.app/recursos" },
    ],
    links: [{ rel: "canonical", href: "https://evoluipdi.lovable.app/recursos" }],
  }),
  component: FeaturesPage,
});

const FEATURES = [
  { title: "RH & Organograma", items: ["Cadastro de colaboradores", "Departamentos e filiais", "Hierarquia editável (drag & drop)", "Convites por e-mail"] },
  { title: "PDI & Feedbacks", items: ["Gaps por competência", "Plano de ação por horizonte (curto/médio/longo prazo)", "Check-ins agendados", "Feedbacks contínuos (FFI)"] },
  { title: "Cargos & Processos", items: ["Catálogo de cargos", "RCF (responsabilidades, competências, formação)", "Fluxograma de processos por cargo", "Critérios de sucesso"] },
  { title: "Entrevistas", items: ["Roteiros estruturados", "Aplicação com pontuação", "Análise por IA com sugestão de nível", "Histórico por colaborador"] },
  { title: "Candidatos", items: ["Pré-entrevista por link público", "Upload e análise de currículo com IA", "Pipeline de contratação", "Conversão para colaborador"] },
  { title: "Ponto Eletrônico", items: ["Geofence configurável por filial", "Selfie no registro", "Escalas e tolerância", "Espelho do mês", "Detecção de anomalias"] },
  { title: "Relatórios & IA", items: ["Indicadores por equipe", "Distribuição por nível", "Sugestões automáticas de PDI", "Análise de tendências"] },
];

function FeaturesPage() {
  return (
    <MarketingLayout>
      <section className="border-b py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h1 className="text-4xl font-bold md:text-5xl">Recursos do Evolui</h1>
          <p className="mt-4 text-muted-foreground">Uma plataforma única para gestão de pessoas, performance e jornada de trabalho.</p>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <Card key={f.title} className="p-6">
                <h2 className="text-lg font-semibold">{f.title}</h2>
                <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {f.items.map((i) => <li key={i}>• {i}</li>)}
                </ul>
              </Card>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button asChild size="lg"><Link to="/login">Testar grátis por 14 dias</Link></Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
