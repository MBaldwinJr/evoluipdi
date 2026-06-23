import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_app/admin/talent/")({ component: TalentDashboard });

function TalentDashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {["Dashboard de Recrutamento", "Dashboard de Candidatos", "Dashboard Executivo"].map((title) => (
        <Card key={title}>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
            <h3 className="text-base font-medium">{title}</h3>
            <p className="text-xs text-muted-foreground">Disponível na Fase 2 após geração de dados reais.</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
