import { z } from "zod";

export const applicationStageEnum = z.enum([
  "applied", "screening", "interview", "technical", "offer", "hired", "rejected",
]);
export const talentStatusEnum = z.enum(["active", "archived", "hired", "blacklisted"]);
export const talentSourceEnum = z.enum(["manual", "import", "application", "referral"]);

export type ApplicationStage = z.infer<typeof applicationStageEnum>;
export type TalentStatus = z.infer<typeof talentStatusEnum>;
export type TalentSource = z.infer<typeof talentSourceEnum>;

export const APPLICATION_STAGES: ApplicationStage[] = [
  "applied", "screening", "interview", "technical", "offer", "hired", "rejected",
];

export const APPLICATION_STAGE_LABEL: Record<ApplicationStage, string> = {
  applied: "Inscritos",
  screening: "Triagem",
  interview: "Entrevista",
  technical: "Teste Técnico",
  offer: "Proposta",
  hired: "Contratado",
  rejected: "Reprovado",
};

export const TALENT_STATUS_LABEL: Record<TalentStatus, string> = {
  active: "Ativo",
  archived: "Arquivado",
  hired: "Contratado",
  blacklisted: "Bloqueado",
};

export const talentSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200).optional().nullable().or(z.literal("").transform(() => null)),
  phone: z.string().max(40).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  linkedin_url: z.string().max(400).optional().nullable(),
  current_position: z.string().max(200).optional().nullable(),
  current_company: z.string().max(200).optional().nullable(),
  years_experience: z.coerce.number().int().nonnegative().default(0),
  skills: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  summary: z.string().max(8000).optional().nullable(),
  source: talentSourceEnum.default("manual"),
  cv_url: z.string().optional().nullable(),
  cv_text: z.string().optional().nullable(),
  status: talentStatusEnum.default("active"),
});
export type TalentInput = z.infer<typeof talentSchema>;

export const applicationSchema = z.object({
  id: z.string().uuid().optional(),
  job_id: z.string().uuid(),
  talent_id: z.string().uuid(),
  stage: applicationStageEnum.default("applied"),
  stage_order: z.coerce.number().int().default(0),
  rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  rejection_reason: z.string().max(2000).optional().nullable(),
  notes: z.string().max(8000).optional().nullable(),
});
export type ApplicationInput = z.infer<typeof applicationSchema>;
