import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/page-header";
export const Route = createFileRoute("/_app/admin/interviews")({ component: () => (
  <><PageHeader title="Roteiros de entrevista" description="Configure roteiros por cargo e tipo (em breve)" />
  <EmptyState title="Em construção" description="Esta área permitirá criar roteiros dinâmicos baseados no RCF." /></>
)});
