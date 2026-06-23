import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing-layout";

export const Route = createFileRoute("/trabalhe-conosco")({
  head: () => ({
    meta: [
      { title: "Trabalhe Conosco — Evolui" },
      { name: "description", content: "Vagas abertas. Encontre sua próxima oportunidade." },
      { property: "og:title", content: "Trabalhe Conosco — Evolui" },
      { property: "og:description", content: "Vagas abertas. Encontre sua próxima oportunidade." },
    ],
  }),
  component: () => (
    <MarketingLayout>
      <Outlet />
    </MarketingLayout>
  ),
});
