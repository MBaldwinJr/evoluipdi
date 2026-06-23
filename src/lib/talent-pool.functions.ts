import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIJson } from "./ai.server";
import { getUserOrgId } from "./org.server";
import {
  talentSchema, applicationSchema, applicationStageEnum,
} from "./talent-pool.types";

// ---------- TALENT POOL ----------
export const upsertTalent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => talentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrgId(userId);
    if (data.id) {
      const { id, ...rest } = data;
      const { error } = await supabase.from("talent_pool").update(rest).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { id: _ignore, ...insert } = data;
    const { data: row, error } = await supabase
      .from("talent_pool")
      .insert({ ...insert, org_id: orgId, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteTalent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("talent_pool").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- APPLICATIONS ----------
export const createApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ job_id: z.string().uuid(), talent_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrgId(userId);
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("job_id", data.job_id)
      .eq("talent_id", data.talent_id)
      .maybeSingle();
    if (existing) return { id: existing.id, existed: true };

    const { data: row, error } = await supabase
      .from("applications")
      .insert({
        org_id: orgId, job_id: data.job_id, talent_id: data.talent_id,
        stage: "applied", stage_order: 0, created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("application_events").insert({
      org_id: orgId, application_id: row.id,
      event_type: "created", payload: {}, created_by: userId,
    });
    return { id: row.id, existed: false };
  });

export const moveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      stage: applicationStageEnum,
      stage_order: z.coerce.number().int(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrgId(userId);
    const { data: prev } = await supabase
      .from("applications").select("stage").eq("id", data.id).maybeSingle();
    const { error } = await supabase
      .from("applications")
      .update({ stage: data.stage, stage_order: data.stage_order })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (prev && prev.stage !== data.stage) {
      await supabase.from("application_events").insert({
        org_id: orgId, application_id: data.id,
        event_type: "stage_changed",
        payload: { from: prev.stage, to: data.stage },
        created_by: userId,
      });
    }
    return { ok: true };
  });

export const updateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applicationSchema.partial({ job_id: true, talent_id: true }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.id) throw new Error("id obrigatório");
    const { id, job_id: _j, talent_id: _t, ...rest } = data;
    const { error } = await context.supabase.from("applications").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("applications").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- AI: fit score ----------
export const scoreApplicationAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ application_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: app, error } = await supabase
      .from("applications")
      .select("id, job:jobs(title,requirements,responsibilities,description,role_id), talent:talent_pool(full_name,summary,skills,years_experience,current_position,current_company)")
      .eq("id", data.application_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app?.job || !app?.talent) throw new Error("Candidatura não encontrada");

    let kpi: Record<string, unknown> | null = null;
    if (app.job.role_id) {
      const { data: k } = await supabase
        .from("position_kpis").select("*").eq("role_id", app.job.role_id).maybeSingle();
      kpi = k;
    }

    const result = await callAIJson<{ score: number; summary: string; strengths: string; gaps: string }>({
      system: "Você é um especialista em recrutamento. Avalie o fit entre candidato e vaga em PT-BR com objetividade.",
      user: `VAGA:\n${JSON.stringify(app.job, null, 2)}\n\nKPIs DO CARGO:\n${kpi ? JSON.stringify(kpi, null, 2) : "—"}\n\nCANDIDATO:\n${JSON.stringify(app.talent, null, 2)}`,
      toolName: "score_application",
      toolDescription: "Calcula o fit do candidato com a vaga",
      parameters: {
        type: "object",
        properties: {
          score: { type: "number", description: "Pontuação 0-100" },
          summary: { type: "string", description: "Resumo da avaliação (3-4 frases)" },
          strengths: { type: "string", description: "Pontos fortes (bullets em texto)" },
          gaps: { type: "string", description: "Lacunas (bullets em texto)" },
        },
        required: ["score", "summary", "strengths", "gaps"],
      },
    });

    const score = Math.max(0, Math.min(100, Math.round(result.score)));
    await supabase.from("applications").update({
      ai_fit_score: score,
      ai_fit_summary: `${result.summary}\n\nPontos fortes:\n${result.strengths}\n\nLacunas:\n${result.gaps}`,
    }).eq("id", data.application_id);

    return { score, summary: result.summary };
  });

// ---------- ADMISSÃO 1-CLIQUE ----------
export const admitApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      application_id: z.string().uuid(),
      hire_date: z.string().optional(),
      contract_type: z.string().optional(),
      weekly_hours: z.coerce.number().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrgId(userId);

    const { data: app, error } = await supabase
      .from("applications")
      .select("id, stage, job:jobs(id,title,role_id,department_id,employment_type), talent:talent_pool(id,full_name)")
      .eq("id", data.application_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!app?.job || !app?.talent) throw new Error("Candidatura não encontrada");

    const { data: emp, error: empErr } = await supabase
      .from("employees")
      .insert({
        org_id: orgId,
        full_name: app.talent.full_name,
        role_id: app.job.role_id ?? null,
        department_id: app.job.department_id ?? null,
        hire_date: data.hire_date ?? new Date().toISOString().slice(0, 10),
        contract_type: data.contract_type ?? (app.job.employment_type ?? "CLT").toString().toUpperCase(),
        weekly_hours: data.weekly_hours ?? 44,
        active: true,
      })
      .select("id")
      .single();
    if (empErr) throw new Error(empErr.message);

    await supabase.from("applications").update({ stage: "hired" }).eq("id", data.application_id);
    await supabase.from("application_events").insert({
      org_id: orgId, application_id: data.application_id,
      event_type: "admitted",
      payload: { employee_id: emp.id },
      created_by: userId,
    });

    // Seed onboarding checklist (documentos, integração, treinamentos)
    const { DEFAULT_ONBOARDING_TEMPLATE } = await import("./onboarding.functions");
    await supabase.from("onboarding_tasks").insert(
      DEFAULT_ONBOARDING_TEMPLATE.map((t, idx) => ({
        org_id: orgId,
        employee_id: emp.id,
        application_id: data.application_id,
        category: t.category,
        title: t.title,
        description: t.description ?? null,
        order_index: idx,
        created_by: userId,
      })),
    );

    return { employee_id: emp.id };
  });
