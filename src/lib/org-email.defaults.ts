import type { TalentEmailVars } from "./org-email.types";

export interface DefaultTemplate {
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly subject: string;
  readonly bodyHtml: string;
  readonly bodyText: string;
  readonly variables: readonly string[];
}

const wrap = (inner: string) => `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;background:#f8fafc;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:24px">
    ${inner}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
    <p style="font-size:12px;color:#64748b">{{org_name}}</p>
  </div>
</body></html>`;

export const DEFAULT_TEMPLATES: readonly DefaultTemplate[] = [
  {
    key: "application_received",
    label: "Candidatura recebida",
    description: "Enviado quando o candidato se inscreve em uma vaga.",
    subject: "Recebemos sua candidatura para {{job_title}}",
    variables: ["candidate_name", "job_title", "org_name"],
    bodyHtml: wrap(`<h2>Olá, {{candidate_name}}!</h2>
<p>Recebemos sua candidatura para a vaga <strong>{{job_title}}</strong>.</p>
<p>Nossa equipe avaliará seu perfil e entrará em contato em breve.</p>`),
    bodyText: "Olá, {{candidate_name}}! Recebemos sua candidatura para {{job_title}}. Entraremos em contato em breve. — {{org_name}}",
  },
  {
    key: "stage_changed",
    label: "Mudança de etapa",
    description: "Notifica o candidato quando muda de etapa no funil.",
    subject: "Atualização sobre sua candidatura — {{job_title}}",
    variables: ["candidate_name", "job_title", "stage_label", "org_name"],
    bodyHtml: wrap(`<h2>Olá, {{candidate_name}}</h2>
<p>Sua candidatura para <strong>{{job_title}}</strong> avançou para a etapa: <strong>{{stage_label}}</strong>.</p>
<p>Boa sorte na próxima etapa!</p>`),
    bodyText: "Olá, {{candidate_name}}. Sua candidatura para {{job_title}} avançou para: {{stage_label}}. — {{org_name}}",
  },
  {
    key: "interview_scheduled",
    label: "Entrevista agendada",
    description: "Confirmação de agendamento de entrevista.",
    subject: "Entrevista agendada — {{job_title}}",
    variables: ["candidate_name", "job_title", "interview_when", "interview_mode", "interview_location", "org_name"],
    bodyHtml: wrap(`<h2>Olá, {{candidate_name}}</h2>
<p>Sua entrevista para a vaga <strong>{{job_title}}</strong> foi agendada.</p>
<p><strong>Quando:</strong> {{interview_when}}<br/>
<strong>Modalidade:</strong> {{interview_mode}}<br/>
<strong>Local / link:</strong> {{interview_location}}</p>`),
    bodyText: "Olá, {{candidate_name}}. Entrevista para {{job_title}} em {{interview_when}} ({{interview_mode}}) — {{interview_location}}. — {{org_name}}",
  },
  {
    key: "application_rejected",
    label: "Candidatura não aprovada",
    description: "Comunicado de não aprovação no processo.",
    subject: "Sobre sua candidatura para {{job_title}}",
    variables: ["candidate_name", "job_title", "org_name"],
    bodyHtml: wrap(`<h2>Olá, {{candidate_name}}</h2>
<p>Agradecemos seu interesse na vaga <strong>{{job_title}}</strong>.</p>
<p>No momento, optamos por seguir com outros candidatos cujo perfil se aproxima mais do que buscamos. Manteremos seu cadastro para futuras oportunidades.</p>`),
    bodyText: "Olá, {{candidate_name}}. Agradecemos seu interesse em {{job_title}}, mas seguiremos com outros candidatos. — {{org_name}}",
  },
  {
    key: "candidate_hired",
    label: "Aprovação / oferta",
    description: "Comunicado de aprovação no processo.",
    subject: "Boas notícias sobre a vaga {{job_title}}!",
    variables: ["candidate_name", "job_title", "org_name"],
    bodyHtml: wrap(`<h2>Parabéns, {{candidate_name}}!</h2>
<p>Você foi aprovado(a) no processo seletivo para a vaga <strong>{{job_title}}</strong>.</p>
<p>Entraremos em contato com os próximos passos.</p>`),
    bodyText: "Parabéns, {{candidate_name}}! Aprovação em {{job_title}}. Entraremos em contato. — {{org_name}}",
  },
];

export const DEFAULT_TEMPLATES_BY_KEY: Readonly<Record<string, DefaultTemplate>> =
  Object.fromEntries(DEFAULT_TEMPLATES.map((t) => [t.key, t]));

export function renderTemplate(tpl: string, vars: TalentEmailVars): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => {
    const v = vars[k as keyof TalentEmailVars];
    return v == null ? "" : String(v);
  });
}
