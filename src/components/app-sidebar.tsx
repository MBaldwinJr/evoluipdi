import { Link, useRouterState } from "@tanstack/react-router";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { LayoutDashboard, User, MessageSquare, Target, Users, Briefcase, ListChecks, FileText, Settings, LogOut, Sparkles, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const meItems = [
  { title: "Meu painel", url: "/me", icon: LayoutDashboard },
  { title: "Meu PDI", url: "/me/pdi", icon: Target },
  { title: "Meus feedbacks", url: "/me/feedbacks", icon: MessageSquare },
];
const teamItems = [
  { title: "Minha equipe", url: "/team", icon: Users },
];
const rhItems = [
  { title: "Colaboradores", url: "/admin/people", icon: User },
  { title: "Cargos & RCF", url: "/admin/roles", icon: Briefcase },
  { title: "Roteiros de entrevista", url: "/admin/interviews", icon: ListChecks },
  { title: "Entrevistas aplicadas", url: "/admin/interviews-review", icon: ClipboardCheck },
  { title: "Relatórios", url: "/admin/reports", icon: FileText },
  { title: "Configurações", url: "/admin/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (r) => r.location.pathname });
  const { isRH, isGestor, signOut, user } = useAuth();
  const isActive = (u: string) => path === u || path.startsWith(u + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary">
            <Sparkles className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Evolui</span>
              <span className="text-xs text-sidebar-foreground/70">Gestão & PDI</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Eu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {meItems.map((it) => (
                <SidebarMenuItem key={it.url}>
                  <SidebarMenuButton asChild isActive={isActive(it.url)}>
                    <Link to={it.url}><it.icon /><span>{it.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isGestor && (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {teamItems.map((it) => (
                  <SidebarMenuItem key={it.url}>
                    <SidebarMenuButton asChild isActive={isActive(it.url)}>
                      <Link to={it.url}><it.icon /><span>{it.title}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isRH && (
          <SidebarGroup>
            <SidebarGroupLabel>RH</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {rhItems.map((it) => (
                  <SidebarMenuItem key={it.url}>
                    <SidebarMenuButton asChild isActive={isActive(it.url)}>
                      <Link to={it.url}><it.icon /><span>{it.title}</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2">
          {!collapsed && user?.email && (
            <p className="mb-2 truncate text-xs text-sidebar-foreground/70">{user.email}</p>
          )}
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />{!collapsed && "Sair"}
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
