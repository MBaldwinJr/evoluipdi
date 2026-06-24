import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_TEMPLATES, DEFAULT_TEMPLATES_BY_KEY, renderTemplate } from "./org-email.defaults";
import type { OrgEmailSettingsView, TalentEmailVars } from "./org-email.types";

async function assertOrgAdmin(supabase: any, userId: string, orgId: string) {
  const { data, error } = await supabase
    .from("org_members")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !["admin", "rh"].includes(data.role)) throw new Error("Permissão negada");
}

const orgIdInput = z.object({ org_id: z.string().uuid() });

// ---------- Settings ----------

export const getOrgEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdInput.parse(d))
  .handler(async ({ data, context }): Promise<OrgEmailSettingsView> => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("org_email_settings")
      .select("is_active,host,port,secure,username,from_name,from_email,reply_to,last_test_at,last_test_ok,last_test_error")
      .eq("org_id", data.org_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      return {
        is_configured: false, is_active: false, host: null, port: null, secure: null,
        username: null, from_name: null, from_email: null, reply_to: null,
        last_test_at: null, last_test_ok: null, last_test_error: null,
      };
    }
    return { is_configured: true, ...row } as OrgEmailSettingsView;
  });

const saveSettingsSchema = z.object({
  org_id: z.string().uuid(),
  host: z.string().min(1).max(255),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().min(1).max(255),
  password: z.string().min(1).max(1000).optional(),
  from_name: z.string().min(1).max(120),
  from_email: z.string().email(),
  reply_to: z.string().email().optional().nullable(),
  is_active: z.boolean(),
});

export const saveOrgEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("org_email_settings").select("password").eq("org_id", data.org_id).maybeSingle();
    const password = data.password ?? existing?.password;
    if (!password) throw new Error("Senha SMTP é obrigatória na primeira configuração");

    const { error } = await supabaseAdmin.from("org_email_settings").upsert({
      org_id: data.org_id,
      host: data.host, port: data.port, secure: data.secure,
      username: data.username, password,
      from_name: data.from_name, from_email: data.from_email,
      reply_to: data.reply_to ?? null,
      is_active: data.is_active,
    }, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const testSchema = z.object({ org_id: z.string().uuid(), to: z.string().email() });

export const testOrgEmailSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => testSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: s, error } = await supabaseAdmin
      .from("org_email_settings").select("*").eq("org_id", data.org_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) throw new Error("Configure o SMTP antes de testar");

    const { sendViaSmtp } = await import("./org-email.server");
    try {
      await sendViaSmtp({
        host: s.host, port: s.port, secure: s.secure,
        username: s.username, password: s.password,
        fromName: s.from_name, fromEmail: s.from_email, replyTo: s.reply_to,
        to: data.to,
        subject: "Teste de configuração de e-mail",
        html: `<p>Olá! Esta é uma mensagem de teste enviada pelo SMTP configurado em sua empresa.</p>`,
        text: "Olá! Esta é uma mensagem de teste enviada pelo SMTP configurado em sua empresa.",
      });
      await supabaseAdmin.from("org_email_settings").update({
        last_test_at: new Date().toISOString(), last_test_ok: true, last_test_error: null,
      }).eq("org_id", data.org_id);
      await supabaseAdmin.from("org_email_outbox").insert({
        org_id: data.org_id, to_email: data.to, subject: "Teste de configuração de e-mail",
        status: "sent", sender: "org_smtp",
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha desconhecida";
      await supabaseAdmin.from("org_email_settings").update({
        last_test_at: new Date().toISOString(), last_test_ok: false, last_test_error: msg,
      }).eq("org_id", data.org_id);
      await supabaseAdmin.from("org_email_outbox").insert({
        org_id: data.org_id, to_email: data.to, subject: "Teste de configuração de e-mail",
        status: "failed", sender: "org_smtp", error: msg,
      });
      throw new Error(msg);
    }
  });

// ---------- Templates ----------

export const listOrgEmailTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const { data: rows, error } = await context.supabase
      .from("org_email_templates")
      .select("id,template_key,subject,body_html,body_text,is_active,updated_at")
      .eq("org_id", data.org_id);
    if (error) throw new Error(error.message);
    const byKey = new Map((rows ?? []).map((r) => [r.template_key, r]));
    return DEFAULT_TEMPLATES.map((d) => {
      const r = byKey.get(d.key);
      return {
        key: d.key, label: d.label, description: d.description,
        variables: d.variables,
        is_customized: !!r,
        is_active: r ? r.is_active : true,
        subject: r?.subject ?? d.subject,
        body_html: r?.body_html ?? d.bodyHtml,
        body_text: r?.body_text ?? d.bodyText,
        updated_at: r?.updated_at ?? null,
      };
    });
  });

const upsertTemplateSchema = z.object({
  org_id: z.string().uuid(),
  template_key: z.string().min(1).max(64),
  subject: z.string().min(1).max(200),
  body_html: z.string().min(1).max(50000),
  body_text: z.string().max(20000).optional().nullable(),
  is_active: z.boolean(),
});

export const upsertOrgEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    if (!DEFAULT_TEMPLATES_BY_KEY[data.template_key]) throw new Error("Template inválido");
    const { error } = await context.supabase.from("org_email_templates").upsert({
      org_id: data.org_id,
      template_key: data.template_key,
      subject: data.subject,
      body_html: data.body_html,
      body_text: data.body_text ?? null,
      is_active: data.is_active,
    }, { onConflict: "org_id,template_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const resetTemplateSchema = z.object({ org_id: z.string().uuid(), template_key: z.string().min(1) });

export const resetOrgEmailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const { error } = await context.supabase
      .from("org_email_templates")
      .delete()
      .eq("org_id", data.org_id)
      .eq("template_key", data.template_key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Outbox ----------

export const listOrgEmailOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => orgIdInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertOrgAdmin(context.supabase, context.userId!, data.org_id);
    const { data: rows, error } = await context.supabase
      .from("org_email_outbox")
      .select("id,template_key,to_email,subject,status,sender,error,created_at")
      .eq("org_id", data.org_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Preview render (for editor) ----------

export const previewOrgEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({
    subject: z.string(),
    body_html: z.string(),
    vars: z.record(z.string(), z.string()).optional(),
  }).parse(d))
  .handler(async ({ data }) => {
    const vars = (data.vars ?? {}) as TalentEmailVars;
    return {
      subject: renderTemplate(data.subject, vars),
      body_html: renderTemplate(data.body_html, vars),
    };
  });
