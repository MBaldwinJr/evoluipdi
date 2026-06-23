import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/_app/admin/talent/settings")({ component: TalentSettings });

function TalentSettings() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <h3 className="text-base font-medium">Configurações</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Em breve: integrações com portais de carreira, redes sociais e personalização de templates.
        </p>
      </CardContent>
    </Card>
  );
}
