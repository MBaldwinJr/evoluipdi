import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callAIJson } from "./ai.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// 1) Estruturar feedback bruto em Fato/Impacto/Próximo passo
export const structureFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ rawText: z.string().min(5).max(4000) }).parse(d))
  .handler(async ({ data }) => {
    return callAIJson<{ fact: string; impact: string; next_step: string }>({
      system: "Você é um especialista em feedback corporativo. Reestruture textos brutos em três campos claros, factuais e acionáveis em português do Brasil. Evite generalidades.",
      user: data.rawText,
      toolName: "structure_feedback",
      toolDescription: "Reestrutura feedback em Fato observado, Impacto e Próximo passo",
      parameters: {
        type: "object",
        properties: {
          fact: { type: "string", description: "Fato concreto e observável" },
          impact: { type: "string", description: "Impacto desse fato no time/projeto/cliente" },
          next_step: { type: "string", description: "Próximo passo claro e acionável" },
        },
        required: ["fact", "impact", "next_step"],
      },
    });
  });

// 2) Sugerir ações 70-20-10 a partir de um ponto de desenvolvimento
export const suggestPdiActions = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ developmentPoint: z.string().min(5).max(1000), context: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data }) => {
    return callAIJson<{ actions: Array<{ category: "pratica" | "troca" | "formal"; description: string }> }>({
      system: "Você é especialista em desenvolvimento de pessoas e aplica o modelo 70-20-10. Para o ponto de desenvolvimento informado, gere 5 ações práticas em português do Brasil: 3 da categoria 'pratica' (70% - desafios reais no trabalho), 1 'troca' (20% - mentoria/shadowing/aprender com pares) e 1 'formal' (10% - curso/leitura/treinamento). Seja específico e acionável.",
      user: `Ponto de desenvolvimento: ${data.developmentPoint}\n\nContexto adicional: ${data.context ?? "—"}`,
      toolName: "suggest_actions",
      toolDescription: "Lista de 5 ações no modelo 70-20-10",
      parameters: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                category: { type: "string", enum: ["pratica", "troca", "formal"] },
                description: { type: "string" },
              },
              required: ["category", "description"],
            },
          },
        },
        required: ["actions"],
      },
    });
  });

// 3) Sugerir gaps a partir do histórico de avaliações + feedbacks
export const suggestGapsFromEmployee = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("*, role:roles_catalog(title, rcf_items:rcf_items(title, kind, expected_level))")
      .eq("id", data.employeeId)
      .maybeSingle();
    const { data: evals } = await supabaseAdmin
      .from("evaluations").select("overall_level, fact, impact, next_step, scores:evaluation_scores(observed_level, expected_level, rcf_item:rcf_items(title))")
      .eq("employee_id", data.employeeId).order("occurred_at", { ascending: false }).limit(5);
    const { data: fbs } = await supabaseAdmin
      .from("feedbacks").select("fact, impact, next_step, kind").eq("employee_id", data.employeeId).order("occurred_at", { ascending: false }).limit(20);

    const ctx = JSON.stringify({ role: (emp as any)?.role, evaluations: evals ?? [], feedbacks: fbs ?? [] }, null, 2);

    return callAIJson<{ gaps: Array<{ title: string; severity: "baixa" | "media" | "alta"; justification: string; root_cause: string }> }>({
      system: "Você é especialista em desenvolvimento humano. Cruze o RCF do cargo com avaliações e feedbacks para identificar de 3 a 5 gaps prioritários. Para cada gap, justifique com fatos do contexto e aplique a técnica dos 5 porquês para sugerir uma causa-raiz curta. Português do Brasil. Seja específico, evite generalidades.",
      user: `Contexto do colaborador:\n${ctx}`,
      toolName: "suggest_gaps",
      toolDescription: "Lista priorizada de gaps com causa-raiz",
      parameters: {
        type: "object",
        properties: {
          gaps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                severity: { type: "string", enum: ["baixa", "media", "alta"] },
                justification: { type: "string" },
                root_cause: { type: "string", description: "Causa-raiz aplicando 5 porquês, em 1-2 frases" },
              },
              required: ["title", "severity", "justification", "root_cause"],
            },
          },
        },
        required: ["gaps"],
      },
    });
  });