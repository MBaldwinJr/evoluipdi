import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { callAIJson } from "./ai.server";

export interface QualityAiInvestigation {
  readonly root_cause: string;
  readonly five_whys: readonly string[];
  readonly ishikawa: {
    readonly metodo: string;
    readonly maquina: string;
    readonly material: string;
    readonly mao_de_obra: string;
    readonly medida: string;
    readonly meio_ambiente: string;
  };
  readonly action_plan: ReadonlyArray<{
    readonly what: string;
    readonly why: string;
    readonly how: string;
    readonly priority: "baixa" | "media" | "alta";
  }>;
  readonly severity_assessment: "baixa" | "media" | "alta" | "critica";
  readonly recommendation: string;
}

const OrgId = z.object({ org_id: z.string().uuid() });

export const qualityListOccurrences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgId.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("quality_occurrences")
      .select("id,code,title,category,sector,severity,status,due_date,created_at")
      .eq("org_id", data.org_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateOccurrence = z.object({
  org_id: z.string().uuid(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  category: z.string().trim().max(80).optional().nullable(),
  sector: z.string().trim().max(80).optional().nullable(),
  severity: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
  due_date: z.string().optional().nullable(),
});

export const qualityCreateOccurrence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateOccurrence.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("quality_occurrences")
      .insert({
        org_id: data.org_id,
        code: "",
        title: data.title,
        description: data.description ?? null,
        category: data.category ?? null,
        sector: data.sector ?? null,
        severity: data.severity,
        due_date: data.due_date ?? null,
        reported_by: context.userId,
      })
      .select("id,code")
      .single();
    if (error) throw new Error(error.message);
    await context.supabase.from("quality_audit_log").insert({
      org_id: data.org_id,
      entity: "quality_occurrence",
      entity_id: row.id,
      action: "create",
      actor: context.userId,
      new_values: data as never,
    });
    return row;
  });

const UpdateStatus = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  status: z.enum(["aberta", "em_analise", "em_acao", "aguardando_aprovacao", "concluida", "cancelada"]),
});

export const qualityUpdateOccurrenceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateStatus.parse(d))
  .handler(async ({ data, context }) => {
    const patch = { status: data.status, closed_at: data.status === "concluida" ? new Date().toISOString() : null };
    const { error } = await context.supabase
      .from("quality_occurrences")
      .update(patch)
      .eq("id", data.id)
      .eq("org_id", data.org_id);
    if (error) throw new Error(error.message);
    await context.supabase.from("quality_audit_log").insert({
      org_id: data.org_id,
      entity: "quality_occurrence",
      entity_id: data.id,
      action: "status_change",
      actor: context.userId,
      new_values: { status: data.status },
    });
    return { ok: true };
  });

export const qualityStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => OrgId.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("quality_occurrences")
      .select("severity,status")
      .eq("org_id", data.org_id);
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    return {
      total: list.length,
      abertas: list.filter((r) => r.status !== "concluida" && r.status !== "cancelada").length,
      criticas: list.filter((r) => r.severity === "critica").length,
      concluidas: list.filter((r) => r.status === "concluida").length,
    };
  });
