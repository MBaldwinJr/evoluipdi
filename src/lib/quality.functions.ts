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

export const qualityInvestigate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), org_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<QualityAiInvestigation> => {
    const { data: occ, error } = await context.supabase
      .from("quality_occurrences")
      .select("title,description,category,sector,severity,status,due_date,code")
      .eq("id", data.id)
      .eq("org_id", data.org_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!occ) throw new Error("Ocorrência não encontrada");

    const severityEnum = ["baixa", "media", "alta", "critica"] as const;
    const priorityEnum = ["baixa", "media", "alta"] as const;

    return callAIJson<QualityAiInvestigation>({
      system:
        "Você é um especialista sênior em Gestão da Qualidade (ISO 9001), PDCA, Ishikawa (6M), 5 Porquês e CAPA. Analise a ocorrência e gere uma investigação estruturada, factual e acionável em português do Brasil. Sem clichês, sem generalidades.",
      user: `Ocorrência ${occ.code}\nTítulo: ${occ.title}\nCategoria: ${occ.category ?? "—"}\nSetor: ${occ.sector ?? "—"}\nGravidade atual: ${occ.severity}\nStatus: ${occ.status}\nDescrição: ${occ.description ?? "—"}`,
      toolName: "investigate_quality_occurrence",
      toolDescription: "Gera causa raiz, 5 porquês, Ishikawa 6M e plano de ação",
      parameters: {
        type: "object",
        properties: {
          root_cause: { type: "string", description: "Hipótese de causa raiz mais provável" },
          five_whys: {
            type: "array",
            items: { type: "string" },
            description: "Exatamente 5 perguntas/respostas encadeadas (Por que? ...)",
          },
          ishikawa: {
            type: "object",
            description: "Causas potenciais classificadas pelas 6M",
            properties: {
              metodo: { type: "string" },
              maquina: { type: "string" },
              material: { type: "string" },
              mao_de_obra: { type: "string" },
              medida: { type: "string" },
              meio_ambiente: { type: "string" },
            },
            required: ["metodo", "maquina", "material", "mao_de_obra", "medida", "meio_ambiente"],
          },
          action_plan: {
            type: "array",
            description: "3 a 6 ações corretivas no formato 5W2H reduzido",
            items: {
              type: "object",
              properties: {
                what: { type: "string", description: "O que fazer" },
                why: { type: "string", description: "Por que essa ação resolve" },
                how: { type: "string", description: "Como executar" },
                priority: { type: "string", enum: [...priorityEnum] },
              },
              required: ["what", "why", "how", "priority"],
            },
          },
          severity_assessment: {
            type: "string",
            enum: [...severityEnum],
            description: "Gravidade recomendada após análise",
          },
          recommendation: { type: "string", description: "Recomendação geral curta para o gestor" },
        },
        required: ["root_cause", "five_whys", "ishikawa", "action_plan", "severity_assessment", "recommendation"],
      },
    });
  });
