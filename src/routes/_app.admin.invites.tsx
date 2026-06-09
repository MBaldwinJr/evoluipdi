import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useOrg } from "@/lib/org-context";
import { inviteList, inviteCreate, inviteRevoke } from "@/lib/invites.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_app/admin/invites")({
  component: InvitesPage,
});

function InvitesPage() {
  const { current, isAdmin, isRH } = useOrg();
  const qc = useQueryClient();
  const listFn = useServerFn(inviteList);
  const createFn = useServerFn(inviteCreate);
  const revokeFn = useServerFn(inviteRevoke);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "rh" | "gestor" | "colaborador">("rh");
  const [busy, setBusy] = useState(false);

  const allowed = isAdmin || isRH;
  const orgId = current?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["invites", orgId],
    queryFn: () => listFn({ data: { org_id: orgId! } }),
    enabled: !!orgId && allowed,
  });

  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  if (!allowed) {
    return <div className="text-sm text-muted-foreground">Apenas admin/RH pode gerenciar convites.</div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setBusy(true);
    try {
      await createFn({ data: { org_id: orgId, email, role } });
      setEmail("");
      toast.success("Convite criado. Copie o link e envie ao convidado.");
      qc.invalidateQueries({ queryKey: ["invites", orgId] });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao criar convite");
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revogar este convite?")) return;
    try {
      await revokeFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["invites", orgId] });
      toast.success("Convite revogado");
    } catch (e: any) { toast.error(e.message); }
  };

  const copyLink = (token: string) => {
    const url = `${origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Convites</h1>
        <p className="text-sm text-muted-foreground">Convide novos administradores, RHs, gestores ou colaboradores sem novo cadastro completo.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Novo convite</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-[1fr_200px_auto] gap-3 items-end">
            <div>
              <Label>E-mail do convidado</Label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="rh">RH</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busy}>Gerar convite</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            <Mail className="inline h-3 w-3 mr-1" />
            O link gerado tem validade de 7 dias. Envie-o pelo seu canal de comunicação (e-mail/WhatsApp) ao convidado.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Convites ativos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : !data || data.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum convite gerado ainda.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((inv: any) => {
                  const expired = new Date(inv.expires_at).getTime() < Date.now();
                  const used = !!inv.accepted_at;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.email}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{inv.role}</Badge></TableCell>
                      <TableCell>
                        {used ? <Badge>Aceito</Badge> : expired ? <Badge variant="destructive">Expirado</Badge> : <Badge variant="secondary">Pendente</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(inv.expires_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {!used && !expired && (
                          <Button size="sm" variant="outline" onClick={() => copyLink(inv.token)}>
                            <Copy className="h-3 w-3 mr-1" />Copiar link
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => revoke(inv.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
