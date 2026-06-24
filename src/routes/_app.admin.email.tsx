import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Mail, Send, RotateCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState, PageHeader } from "@/components/page-header";
import { useOrg } from "@/lib/org-context";
import {
  getOrgEmailSettings, saveOrgEmailSettings, testOrgEmailSettings,
  listOrgEmailTemplates, upsertOrgEmailTemplate, resetOrgEmailTemplate,
  listOrgEmailOutbox,
} from "@/lib/org-email.functions";

export const Route = createFileRoute("/_app/admin/email")({ component: EmailSettingsPage });

function EmailSettingsPage() {
  const { current, isAdmin, isRH } = useOrg();
  if (!current) return <EmptyState title="Selecione uma empresa" description="" />;
  if (!isAdmin && !isRH) return <EmptyState title="Acesso restrito" description="Apenas admin/RH." />;

  return (
    <div className="space-y-6">
      <PageHeader title="E-mails" description="Configure o envio de e-mails da sua empresa" />
      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp">SMTP</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="outbox">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="smtp" className="mt-4"><SmtpTab orgId={current.id} /></TabsContent>
        <TabsContent value="templates" className="mt-4"><TemplatesTab orgId={current.id} /></TabsContent>
        <TabsContent value="outbox" className="mt-4"><OutboxTab orgId={current.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- SMTP ----------------

function SmtpTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getOrgEmailSettings);
  const saveFn = useServerFn(saveOrgEmailSettings);
  const testFn = useServerFn(testOrgEmailSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["org-email-settings", orgId],
    queryFn: () => getFn({ data: { org_id: orgId } }),
  });

  const [form, setForm] = useState({
    host: "", port: 587, secure: false, username: "", password: "",
    from_name: "", from_email: "", reply_to: "", is_active: true,
  });
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");

  if (data && !hydrated) {
    setHydrated(true);
    if (data.is_configured) {
      setForm({
        host: data.host ?? "", port: data.port ?? 587, secure: !!data.secure,
        username: data.username ?? "", password: "",
        from_name: data.from_name ?? "", from_email: data.from_email ?? "",
        reply_to: data.reply_to ?? "", is_active: !!data.is_active,
      });
    }
  }

  const save = async () => {
    setSaving(true);
    try {
      await saveFn({ data: {
        org_id: orgId, host: form.host, port: Number(form.port), secure: form.secure,
        username: form.username, password: form.password || undefined,
        from_name: form.from_name, from_email: form.from_email,
        reply_to: form.reply_to || null, is_active: form.is_active,
      }});
      toast.success("Configurações salvas");
      setForm((f) => ({ ...f, password: "" }));
      qc.invalidateQueries({ queryKey: ["org-email-settings", orgId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  const test = async () => {
    if (!testTo) return toast.error("Informe um e-mail destinatário");
    setTesting(true);
    try {
      await testFn({ data: { org_id: orgId, to: testTo } });
      toast.success("E-mail de teste enviado");
      qc.invalidateQueries({ queryKey: ["org-email-settings", orgId] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Falha no teste"); }
    finally { setTesting(false); }
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Servidor SMTP</CardTitle>
          <CardDescription>Funciona com Gmail, Outlook, SendGrid, Mailgun, Amazon SES, etc.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Host</Label>
              <Input placeholder="smtp.exemplo.com" value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Porta</Label>
              <Input type="number" value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.secure} onCheckedChange={(v) => setForm({ ...form, secure: v })} />
            <Label className="text-xs">Conexão SSL/TLS implícita (porta 465). Desligado usa STARTTLS (587).</Label>
          </div>
          <Separator />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Usuário</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha {data?.is_configured && <span className="text-muted-foreground">(deixe em branco para manter)</span>}</Label>
              <Input type="password" autoComplete="new-password" value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          </div>
          <Separator />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do remetente</Label>
              <Input value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail do remetente</Label>
              <Input type="email" value={form.from_email}
                onChange={(e) => setForm({ ...form, from_email: e.target.value })} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Responder para (opcional)</Label>
              <Input type="email" value={form.reply_to}
                onChange={(e) => setForm({ ...form, reply_to: e.target.value })} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label className="text-xs">Ativar envio pelos meus servidores. Quando desativado, usamos o remetente padrão da plataforma.</Label>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teste de envio</CardTitle>
          <CardDescription>Envie uma mensagem real para validar as credenciais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Destinatário</Label>
            <Input type="email" placeholder="voce@empresa.com" value={testTo}
              onChange={(e) => setTestTo(e.target.value)} />
          </div>
          <Button onClick={test} disabled={testing || !data?.is_configured} className="w-full">
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar teste
          </Button>
          {data?.last_test_at && (
            <div className="rounded-md border bg-muted/40 p-3 text-xs">
              <div className="flex items-center gap-2">
                {data.last_test_ok
                  ? <><CheckCircle2 className="h-4 w-4 text-emerald-600" /><span>Último teste: sucesso</span></>
                  : <><AlertCircle className="h-4 w-4 text-destructive" /><span>Último teste: falhou</span></>}
              </div>
              <div className="mt-1 text-muted-foreground">{new Date(data.last_test_at).toLocaleString("pt-BR")}</div>
              {data.last_test_error && <div className="mt-1 text-destructive">{data.last_test_error}</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------- Templates ----------------

function TemplatesTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listOrgEmailTemplates);
  const upsertFn = useServerFn(upsertOrgEmailTemplate);
  const resetFn = useServerFn(resetOrgEmailTemplate);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["org-email-templates", orgId],
    queryFn: () => listFn({ data: { org_id: orgId } }),
  });

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const active = templates.find((t) => t.key === activeKey) ?? templates[0];

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!active) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px,1fr]">
      <Card>
        <CardContent className="p-2">
          {templates.map((t) => (
            <button key={t.key}
              onClick={() => setActiveKey(t.key)}
              className={`flex w-full flex-col items-start gap-1 rounded-md p-3 text-left text-sm hover:bg-muted ${active.key === t.key ? "bg-muted" : ""}`}>
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-medium">{t.label}</span>
                {t.is_customized && <Badge variant="secondary" className="text-[10px]">editado</Badge>}
              </div>
              <span className="text-xs text-muted-foreground line-clamp-2">{t.description}</span>
            </button>
          ))}
        </CardContent>
      </Card>

      <TemplateEditor
        key={active.key}
        orgId={orgId}
        template={active}
        onSaved={() => qc.invalidateQueries({ queryKey: ["org-email-templates", orgId] })}
        onReset={async () => {
          await resetFn({ data: { org_id: orgId, template_key: active.key } });
          toast.success("Template restaurado para o padrão");
          qc.invalidateQueries({ queryKey: ["org-email-templates", orgId] });
        }}
        upsert={upsertFn}
      />
    </div>
  );
}

function TemplateEditor({
  orgId, template, onSaved, onReset, upsert,
}: {
  orgId: string;
  template: { key: string; label: string; subject: string; body_html: string; body_text: string; is_active: boolean; variables: readonly string[]; is_customized: boolean };
  onSaved: () => void;
  onReset: () => Promise<void>;
  upsert: ReturnType<typeof useServerFn<typeof upsertOrgEmailTemplate>>;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [bodyHtml, setBodyHtml] = useState(template.body_html);
  const [bodyText, setBodyText] = useState(template.body_text ?? "");
  const [isActive, setIsActive] = useState(template.is_active);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsert({ data: {
        org_id: orgId, template_key: template.key, subject,
        body_html: bodyHtml, body_text: bodyText || null, is_active: isActive,
      }});
      toast.success("Template salvo");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">{template.label}</CardTitle>
          <CardDescription className="mt-1">
            Variáveis: {template.variables.map((v) => <code key={v} className="mx-0.5 rounded bg-muted px-1.5 py-0.5 text-xs">{`{{${v}}}`}</code>)}
          </CardDescription>
        </div>
        {template.is_customized && (
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />Restaurar padrão
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Assunto</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Corpo (HTML)</Label>
          <Textarea rows={12} value={bodyHtml} className="font-mono text-xs"
            onChange={(e) => setBodyHtml(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Versão texto (fallback)</Label>
          <Textarea rows={4} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label className="text-xs">Disparar este e-mail automaticamente</Label>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------- Outbox ----------------

function OutboxTab({ orgId }: { orgId: string }) {
  const listFn = useServerFn(listOrgEmailOutbox);
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["org-email-outbox", orgId],
    queryFn: () => listFn({ data: { org_id: orgId } }),
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (rows.length === 0) return <EmptyState title="Sem envios ainda" description="Os e-mails enviados aparecerão aqui." />;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 text-sm">
              <StatusDot status={r.status} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.subject}</div>
                <div className="text-xs text-muted-foreground">
                  Para {r.to_email} · {r.sender === "org_smtp" ? "SMTP da empresa" : r.sender === "platform_default" ? "Remetente padrão" : "—"}
                  {r.template_key && <> · {r.template_key}</>}
                </div>
                {r.error && <div className="text-xs text-destructive">{r.error}</div>}
              </div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: "bg-emerald-500", failed: "bg-destructive",
    fallback: "bg-amber-500", skipped: "bg-muted-foreground",
  };
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${map[status] ?? "bg-muted"}`} />;
}
