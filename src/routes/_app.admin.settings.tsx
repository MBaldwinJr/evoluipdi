import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
export const Route = createFileRoute("/_app/admin/settings")({ component: () => (
  <><PageHeader title="Configurações" description="Preferências do workspace" />
  <Card><CardContent className="pt-6 text-sm text-muted-foreground">As configurações detalhadas serão disponibilizadas em breve. Por ora, todos os ajustes principais estão em Cargos &amp; RCF e Colaboradores.</CardContent></Card></>
)});
