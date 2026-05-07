import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const { user, isRH } = useAuth();
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: counts } = useQuery({
    queryKey: ["workspace-counts"], enabled: isRH,
    queryFn: async () => {
      const [emps, roles, depts, tpls] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }),
        supabase.from("roles_catalog").select("id", { count: "exact", head: true }),
        supabase.from("departments").select("id", { count: "exact", head: true }),
        supabase.from("interview_templates").select("id", { count: "exact", head: true }),
      ]);
      return { emps: emps.count ?? 0, roles: roles.count ?? 0, depts: depts.count ?? 0, tpls: tpls.count ?? 0 };
    },
  });

  useEffect(() => { if (profile?.full_name) setName(profile.full_name); }, [profile?.full_name]);

  if (!user) return <EmptyState title="Faça login" description="Entre para acessar suas preferências." />;

  const saveProfile = async () => {
    if (!name.trim()) return toast.error("Informe o nome");
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  };

  const changePassword = async () => {
    if (pwd.length < 6) return toast.error("A senha precisa ter ao menos 6 caracteres");
    if (pwd !== pwd2) return toast.error("As senhas não coincidem");
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) return toast.error(error.message);
    setPwd(""); setPwd2("");
    toast.success("Senha alterada");
  };

  return (
    <>
      <PageHeader title="Configurações" description="Seu perfil, segurança e visão do workspace" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Perfil</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>E-mail</Label><Input value={user.email ?? ""} disabled /></div>
            <div className="space-y-1"><Label>Nome completo</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <Button onClick={saveProfile} disabled={savingProfile}>{savingProfile ? "Salvando..." : "Salvar perfil"}</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Segurança</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Nova senha</Label><Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} /></div>
            <div className="space-y-1"><Label>Confirmar senha</Label><Input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} /></div>
            <Button onClick={changePassword} disabled={savingPwd}>{savingPwd ? "Atualizando..." : "Alterar senha"}</Button>
          </CardContent>
        </Card>

        {isRH && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Workspace</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Stat label="Colaboradores" value={counts?.emps ?? 0} />
                <Stat label="Cargos" value={counts?.roles ?? 0} />
                <Stat label="Setores" value={counts?.depts ?? 0} />
                <Stat label="Roteiros" value={counts?.tpls ?? 0} />
              </div>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                Gerencie cargos e setores em <strong>Cargos &amp; RCF</strong>, roteiros em <strong>Roteiros de entrevista</strong> e usuários em <strong>Colaboradores</strong>.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
