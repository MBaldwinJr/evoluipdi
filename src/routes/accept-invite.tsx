import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { inviteValidate, inviteAccept } from "@/lib/invites.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: z.object({ token: z.string().min(32).max(128).optional() }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const { session } = useAuth();
  const navigate = useNavigate();
  const validateFn = useServerFn(inviteValidate);
  const acceptFn = useServerFn(inviteAccept);
  const [accepting, setAccepting] = useState(false);

  const { data: invite, error, isLoading } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => validateFn({ data: { token: token! } }),
    enabled: !!token && !!session,
    retry: false,
  });

  if (!token) {
    return <Centered>Link de convite inválido — token ausente.</Centered>;
  }

  if (!session) {
    const next = encodeURIComponent(`/accept-invite?token=${token}`);
    return (
      <Centered>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit"><Building2 className="h-6 w-6 text-primary" /></div>
            <CardTitle>Você foi convidado</CardTitle>
            <CardDescription>Entre ou crie sua conta para aceitar o convite.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full"><Link to="/login" search={{ next } as any}>Já tenho conta — entrar</Link></Button>
            <Button asChild variant="outline" className="w-full"><Link to="/signup" search={{ next } as any}>Criar conta</Link></Button>
          </CardContent>
        </Card>
      </Centered>
    );
  }

  if (isLoading) return <Centered>Validando convite…</Centered>;
  if (error) return <Centered><span className="text-destructive">{(error as Error).message}</span></Centered>;
  if (!invite) return <Centered>Convite não encontrado.</Centered>;

  const accept = async () => {
    setAccepting(true);
    try {
      const res = await acceptFn({ data: { token } });
      if (typeof window !== "undefined") localStorage.setItem("active_org_id", res.org_id);
      toast.success("Convite aceito! Bem-vindo(a) à empresa.");
      window.location.href = "/me";
    } catch (e: any) {
      toast.error(e.message);
    } finally { setAccepting(false); }
  };

  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto rounded-full bg-primary/10 p-3 w-fit"><Building2 className="h-6 w-6 text-primary" /></div>
          <CardTitle>{invite.org_name ?? "Empresa"}</CardTitle>
          <CardDescription>
            Convite para entrar como <strong className="capitalize">{invite.role}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            E-mail do convite: <strong className="text-foreground">{invite.email}</strong>
          </div>
          <Button onClick={accept} disabled={accepting} className="w-full">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {accepting ? "Vinculando…" : "Aceitar e entrar na empresa"}
          </Button>
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6 bg-background">{children}</div>;
}
