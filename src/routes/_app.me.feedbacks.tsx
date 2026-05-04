import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_app/me/feedbacks")({ component: MyFeedbacks });

function MyFeedbacks() {
  const { user } = useAuth();
  const { data: emp } = useQuery({
    queryKey: ["me-emp-fb", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("employees").select("id").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: received = [] } = useQuery({
    queryKey: ["fb-received", emp?.id], enabled: !!emp,
    queryFn: async () => (await supabase.from("feedbacks").select("*").eq("employee_id", emp!.id).order("occurred_at", { ascending: false })).data ?? [],
  });
  const { data: given = [] } = useQuery({
    queryKey: ["fb-given", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("feedbacks").select("*").eq("author_id", user!.id).order("occurred_at", { ascending: false })).data ?? [],
  });

  return (
    <>
      <PageHeader title="Meus feedbacks" description="Linha do tempo de tudo que você recebeu e deu" />
      <Tabs defaultValue="recebidos">
        <TabsList><TabsTrigger value="recebidos">Recebidos</TabsTrigger><TabsTrigger value="dados">Que eu dei</TabsTrigger></TabsList>
        <TabsContent value="recebidos"><FbList items={received} /></TabsContent>
        <TabsContent value="dados"><FbList items={given} /></TabsContent>
      </Tabs>
    </>
  );
}

function FbList({ items }: { items: any[] }) {
  if (!items.length) return <EmptyState title="Sem feedbacks" description="Nenhum registro nesta visão." />;
  return (
    <div className="space-y-3">
      {items.map((f) => (
        <Card key={f.id}><CardContent className="space-y-2 pt-6">
          <div className="flex items-center gap-2">
            <Badge variant={f.kind === "formal" ? "default" : "secondary"}>{f.kind}</Badge>
            <span className="text-xs text-muted-foreground">{new Date(f.occurred_at).toLocaleString("pt-BR")}</span>
          </div>
          <p className="text-sm"><strong>Fato:</strong> {f.fact}</p>
          {f.impact && <p className="text-sm"><strong>Impacto:</strong> {f.impact}</p>}
          {f.next_step && <p className="text-sm"><strong>Próximo passo:</strong> {f.next_step}</p>}
        </CardContent></Card>
      ))}
    </div>
  );
}
