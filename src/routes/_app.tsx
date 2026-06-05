import { createFileRoute, Outlet, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { orgListMine, orgGetEntitlements } from "@/lib/org.functions";
import { billingGetStatus } from "@/lib/billing.functions";
import { OrgProvider, type Org } from "@/lib/org-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { Building2, Sparkles, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(orgListMine);
  const entFn = useServerFn(orgGetEntitlements);

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["orgs", "mine"],
    queryFn: () => listFn(),
  });

  const [activeId, setActiveId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("active_org_id"),
  );

  useEffect(() => {
    if (orgs && orgs.length === 0) {
      navigate({ to: "/onboarding" });
    }
    if (orgs && orgs.length > 0) {
      const id = activeId && orgs.find((o) => o.id === activeId) ? activeId : orgs[0].id;
      if (id !== activeId) {
        setActiveId(id);
        if (typeof window !== "undefined") localStorage.setItem("active_org_id", id);
      }
    }
  }, [orgs, activeId, navigate]);

  const { data: ent, isLoading: entLoading } = useQuery({
    queryKey: ["org", "entitlements", activeId],
    queryFn: () => entFn({ data: { org_id: activeId! } }),
    enabled: !!activeId,
  });

  if (loading || orgsLoading || (orgs && orgs.length > 0 && (entLoading || !ent))) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
  }

  if (!orgs || orgs.length === 0) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Redirecionando ao cadastro de empresa...</div>;
  }

  const orgList = orgs as Org[];

  return (
    <OrgProvider orgs={orgList} entitlements={ent ?? { plan_code: "free", modules: [] }}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <header className="flex h-14 items-center gap-2 border-b bg-card px-4">
              <SidebarTrigger />
              <OrgHeaderSwitcher orgs={orgList} activeId={activeId!} />
              <div className="ml-auto text-xs text-muted-foreground">
                Plano: <span className="font-medium text-foreground">{ent?.plan_code ?? "free"}</span>
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </OrgProvider>
  );
}

function OrgHeaderSwitcher({ orgs, activeId }: { orgs: Org[]; activeId: string }) {
  const onChange = (id: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("active_org_id", id);
      window.location.reload();
    }
  };
  if (orgs.length === 1) {
    const o = orgs[0];
    return (
      <div className="ml-2 flex items-center gap-2 text-sm">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{o.trade_name || o.legal_name}</span>
      </div>
    );
  }
  return (
    <div className="ml-2 flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={activeId} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
        <SelectContent>
          {orgs.map((o) => (
            <SelectItem key={o.id} value={o.id}>{o.trade_name || o.legal_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
