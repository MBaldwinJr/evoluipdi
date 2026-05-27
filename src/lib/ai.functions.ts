import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIJson } from "./ai.server";
import { getEmployeeAiContext } from "./ai-data.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function canAccessEmployee(userId: string, employeeId: string) {
  const { data: roleRow } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "rh").maybeSingle();
  if (roleRow) return true;
  const { data: emp } = await supabaseAdmin.from("employees").select("user_id, manager_id").eq("id", employeeId).maybeSingle();
  if (!emp) return false;
  if (emp.user_id === userId) return true;
  if (emp.manager_id) {
    const { data: mgr } = await supabaseAdmin.from("employees").select("user_id").eq("id", emp.manager_id).maybeSingle();
    if (mgr?.user_id === userId) return true;
  }
  return false;
}

// 1) Estruturar feedback bruto em Fato/Impacto/Próximo passo
export const structureFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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

// 2) Sugerir ações 70-20-10
export const suggestPdiActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ developmentPoint: z.string().min(5).max(1000), context: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data }) => {
    return callAIJson<{ actions: Array<{ category: "pratica" | "troca" | "formal"; description: string }> }>({
      system: "Você é especialista em desenvolvimento de pessoas e aplica o modelo 70-20-10. Para o ponto de desenvolvimento informado, gere 5 ações práticas em português do Brasil: 3 da categoria 'pratica' (70%), 1 'troca' (20%) e 1 'formal' (10%). Seja específico e acionável.",
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

// 3) Sugerir gaps — exige autorização sobre o colaborador
export const suggestGapsFromEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ok = await canAccessEmployee(context.userId, data.employeeId);
    if (!ok) throw new Error("Acesso negado a este colaborador");
    const ctx = await getEmployeeAiContext(data.employeeId);

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
