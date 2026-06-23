import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIJson } from "./ai.server";
import {
  jobSchema,
  positionKpiSchema,
  jobTemplateSchema,
} from "./talent.types";

// ---------- JOBS ----------
export const upsertJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      ...data,
      closing_date: data.closing_date || null,
      created_by: userId,
    };
    if (data.id) {
      const { id, ...rest } = payload;
      const { data: row, error } = await supabase
        .from("jobs")
        .update(rest)
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: row.id };
    }
    const { data: row, error } = await supabase
      .from("jobs")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("jobs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- POSITION KPIs ----------
export const upsertPositionKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => positionKpiSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabase.from("position_kpis").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    // upsert by (org_id, role_id) — org_id set by trigger
    const { data: existing } = await supabase
      .from("position_kpis")
      .select("id")
      .eq("role_id", data.role_id)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase.from("position_kpis").update(data).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id };
    }
    const { data: row, error } = await supabase
      .from("position_kpis")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deletePositionKpi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("position_kpis").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- TEMPLATES ----------
export const upsertJobTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => jobTemplateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabase.from("job_templates").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await supabase
      .from("job_templates")
      .insert(data)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteJobTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("job_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI: gera descrição completa da vaga ----------
export const generateJobDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      jobId: z.string().uuid().optional(),
      title: z.string().min(2),
      role_id: z.string().uuid().optional().nullable(),
      department_name: z.string().optional().nullable(),
      work_model: z.string().optional().nullable(),
      employment_type: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      salary_min: z.number().optional().nullable(),
      salary_max: z.number().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let kpi: Record<string, unknown> | null = null;
    if (data.role_id) {
      const { data: row } = await supabase
        .from("position_kpis")
        .select("*")
        .eq("role_id", data.role_id)
        .maybeSingle();
      kpi = row;
    }

    const result = await callAIJson<{
      objective: string;
      responsibilities: string;
      requirements: string;
      technical_skills: string;
      soft_skills: string;
      benefits: string;
      schedule: string;
      differentials: string;
      description: string;
    }>({
      system:
        "Você é um especialista em descrição de vagas de emprego em português do Brasil. Crie textos profissionais, claros, atrativos e específicos. Evite jargões genéricos. Use linguagem inclusiva.",
      user: `Crie a descrição completa para a vaga abaixo, em PT-BR:\n\nCargo: ${data.title}\nDepartamento: ${data.department_name ?? "—"}\nLocal: ${data.location ?? "—"}\nModelo: ${data.work_model ?? "—"}\nContratação: ${data.employment_type ?? "—"}\nSalário: ${data.salary_min ?? "—"} a ${data.salary_max ?? "—"}\n\nKPIs do cargo (use para fundamentar requisitos, competências e benefícios):\n${kpi ? JSON.stringify(kpi, null, 2) : "Sem KPIs cadastrados — gere baseado no cargo."}`,
      toolName: "generate_job_description",
      toolDescription: "Gera os blocos de uma descrição de vaga",
      parameters: {
        type: "object",
        properties: {
          objective: { type: "string", description: "Objetivo da função em 2-3 frases" },
          responsibilities: { type: "string", description: "Lista de principais atividades (bullets em texto)" },
          requirements: { type: "string", description: "Requisitos obrigatórios (bullets em texto)" },
          technical_skills: { type: "string", description: "Competências técnicas" },
          soft_skills: { type: "string", description: "Competências comportamentais" },
          benefits: { type: "string", description: "Benefícios oferecidos" },
          schedule: { type: "string", description: "Jornada de trabalho" },
          differentials: { type: "string", description: "Diferenciais" },
          description: {
            type: "string",
            description: "Texto final consolidado da vaga, pronto para publicar, com seções marcadas",
          },
        },
        required: [
          "objective", "responsibilities", "requirements", "technical_skills",
          "soft_skills", "benefits", "schedule", "differentials", "description",
        ],
      },
    });

    return result;
  });
