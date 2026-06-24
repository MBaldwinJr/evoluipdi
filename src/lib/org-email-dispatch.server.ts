import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEFAULT_TEMPLATES_BY_KEY, renderTemplate } from "./org-email.defaults";
import { sendViaSmtp } from "./org-email.server";
import type { TalentEmailVars } from "./org-email.types";

export const STAGE_LABEL_PT: Record<string, string> = {
  applied: "Inscritos",
  screening: "Triagem",
  interview: "Entrevista",
  technical: "Teste técnico",
  offer: "Proposta",
  hired: "Contratado",
  rejected: "Reprovado",
};

export const INTERVIEW_MODE_LABEL: Record<string, string> = {
  online: "Online",
  presencial: "Presencial",
  telefone: "Telefone",
};

interface DispatchInput {
  readonly orgId: string;
  readonly templateKey: string;
  readonly to: string;
  readonly vars: TalentEmailVars;
}

/**
 * Centralized template-based email dispatch. Loads org template overrides,
 * org SMTP settings, sends via SMTP or marks as fallback. Always logs to outbox.
 */
export async function sendOrgEmailEvent(input: DispatchInput): Promise<void> {
  const { orgId, templateKey, to, vars } = input;
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return;

  const def = DEFAULT_TEMPLATES_BY_KEY[templateKey];
  if (!def) return;

  // Load per-org override (if any)
  const { data: override } = await supabaseAdmin
    .from("org_email_templates")
    .select("subject,body_html,body_text,is_active")
    .eq("org_id", orgId)
    .eq("template_key", templateKey)
    .maybeSingle();

  if (override && override.is_active === false) {
    await supabaseAdmin.from("org_email_outbox").insert({
      org_id: orgId, template_key: templateKey, to_email: to,
      subject: override.subject ?? def.subject, status: "skipped", sender: "none",
      error: "Template desativado pela empresa",
    });
    return;
  }

  const subject = renderTemplate(override?.subject ?? def.subject, vars);
  const html = renderTemplate(override?.body_html ?? def.bodyHtml, vars);
  const text = renderTemplate(override?.body_text ?? def.bodyText, vars);

  const { data: settings } = await supabaseAdmin
    .from("org_email_settings").select("*").eq("org_id", orgId).maybeSingle();

  if (settings?.is_active) {
    try {
      await sendViaSmtp({
        host: settings.host, port: settings.port, secure: settings.secure,
        username: settings.username, password: settings.password,
        fromName: settings.from_name, fromEmail: settings.from_email,
        replyTo: settings.reply_to,
        to, subject, html, text,
      });
      await supabaseAdmin.from("org_email_outbox").insert({
        org_id: orgId, template_key: templateKey, to_email: to, subject,
        status: "sent", sender: "org_smtp",
      });
      return;
    } catch (e) {
      await supabaseAdmin.from("org_email_outbox").insert({
        org_id: orgId, template_key: templateKey, to_email: to, subject,
        status: "failed", sender: "org_smtp",
        error: e instanceof Error ? e.message : "Erro SMTP",
      });
      return;
    }
  }

  // No active org SMTP — fallback marker. Platform-default send wiring is
  // handled separately; here we record the intent so admins can audit.
  await supabaseAdmin.from("org_email_outbox").insert({
    org_id: orgId, template_key: templateKey, to_email: to, subject,
    status: "fallback", sender: "platform_default",
    error: "SMTP da empresa não configurado — registrado para envio pelo remetente padrão",
  });
}

interface ApplicationContext {
  readonly orgId: string;
  readonly to: string | null;
  readonly vars: TalentEmailVars;
}

/** Loads candidate + job + org info needed by talent-acquisition templates. */
export async function loadApplicationEmailContext(applicationId: string): Promise<ApplicationContext | null> {
  const { data } = await supabaseAdmin
    .from("applications")
    .select("org_id, talent:talent_pool(full_name,email), job:jobs(title), org:orgs(trade_name,legal_name)")
    .eq("id", applicationId)
    .maybeSingle();
  if (!data) return null;
  const talent = data.talent as { full_name?: string; email?: string } | null;
  const job = data.job as { title?: string } | null;
  const org = data.org as { trade_name?: string | null; legal_name?: string } | null;
  return {
    orgId: data.org_id as string,
    to: talent?.email ?? null,
    vars: {
      candidate_name: talent?.full_name ?? "",
      job_title: job?.title ?? "",
      org_name: org?.trade_name || org?.legal_name || "",
    },
  };
}
