import { z } from "zod";

export const jobStatusEnum = z.enum(["draft", "open", "paused", "closed", "cancelled"]);
export const workModelEnum = z.enum(["presencial", "hibrido", "remoto"]);
export const employmentTypeEnum = z.enum(["clt", "pj", "estagio", "temporario", "aprendiz", "terceirizado"]);

export type JobStatus = z.infer<typeof jobStatusEnum>;
export type WorkModel = z.infer<typeof workModelEnum>;
export type EmploymentType = z.infer<typeof employmentTypeEnum>;

export const jobSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().max(40).optional().nullable(),
  title: z.string().trim().min(2).max(200),
  role_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  work_model: workModelEnum.default("presencial"),
  employment_type: employmentTypeEnum.default("clt"),
  vacancies_quantity: z.coerce.number().int().positive().default(1),
  salary_min: z.coerce.number().int().nonnegative().optional().nullable(),
  salary_max: z.coerce.number().int().nonnegative().optional().nullable(),
  benefits: z.array(z.string()).default([]),
  requirements: z.string().max(8000).optional().nullable(),
  responsibilities: z.string().max(8000).optional().nullable(),
  description: z.string().max(12000).optional().nullable(),
  status: jobStatusEnum.default("draft"),
  closing_date: z.string().optional().nullable(),
});
export type JobInput = z.infer<typeof jobSchema>;

export const positionKpiSchema = z.object({
  id: z.string().uuid().optional(),
  role_id: z.string().uuid(),
  education_required: z.string().max(200).optional().nullable(),
  experience_years: z.coerce.number().int().nonnegative().default(0),
  mandatory_courses: z.array(z.string()).default([]),
  mandatory_certifications: z.array(z.string()).default([]),
  required_skills: z.array(z.string()).default([]),
  soft_skills: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  salary_reference: z.coerce.number().int().nonnegative().optional().nullable(),
  work_schedule: z.string().max(200).optional().nullable(),
  work_location: z.string().max(200).optional().nullable(),
  travel_required: z.boolean().default(false),
  driver_license: z.string().max(10).optional().nullable(),
});
export type PositionKpiInput = z.infer<typeof positionKpiSchema>;

export const jobTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  department_id: z.string().uuid().optional().nullable(),
  description_template: z.string().max(12000).optional().nullable(),
  requirements_template: z.string().max(8000).optional().nullable(),
  responsibilities_template: z.string().max(8000).optional().nullable(),
});
export type JobTemplateInput = z.infer<typeof jobTemplateSchema>;

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  draft: "Rascunho",
  open: "Aberta",
  paused: "Pausada",
  closed: "Encerrada",
  cancelled: "Cancelada",
};

export const WORK_MODEL_LABEL: Record<WorkModel, string> = {
  presencial: "Presencial",
  hibrido: "Híbrido",
  remoto: "Remoto",
};

export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  clt: "CLT",
  pj: "PJ",
  estagio: "Estágio",
  temporario: "Temporário",
  aprendiz: "Aprendiz",
  terceirizado: "Terceirizado",
};
