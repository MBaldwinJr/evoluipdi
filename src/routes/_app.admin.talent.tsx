import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Briefcase, Target, FileText, BarChart3, Settings, Users, ClipboardCheck, CalendarDays, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/talent")({ component: TalentLayout });

const tabs = [
  { to: "/admin/talent", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/talent/jobs", label: "Vagas", icon: Briefcase },
  { to: "/admin/talent/pool", label: "Banco de Talentos", icon: Users },
  { to: "/admin/candidates", label: "Candidatos / Pré-entrevistas", icon: UserPlus },
  { to: "/admin/talent/interviews", label: "Entrevistas", icon: CalendarDays },
  { to: "/admin/talent/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { to: "/admin/talent/kpis", label: "KPIs dos Cargos", icon: Target },
  { to: "/admin/talent/templates", label: "Templates", icon: FileText },
  { to: "/admin/talent/settings", label: "Configurações", icon: Settings },
];

function TalentLayout() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (to: string, exact?: boolean) =>
    exact ? path === to : path === to || path.startsWith(to + "/");
  return (
    <div className="container mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Talent Acquisition AI</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recrutamento e seleção com inteligência artificial.</p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive(t.to, t.exact)
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
