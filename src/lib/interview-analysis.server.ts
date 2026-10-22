import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireInterviewAccess, type AuthenticatedClient } from "./security-access";
import { z } from "zod";
import { callAIJson } from "./ai.server";

const analysisSchema = z.object({
  summary: z.string(), strengths: z.array(z.string()), concerns: z.array(z.string()),
  signals: z.array(z.object({ question: z.string(), insight: z.string(), sentiment: z.enum(["positivo", "neutro", "atencao"]) })),
  suggested_gaps: z.array(z.object({ title: z.string(), severity: z.enum(["baixa", "media", "alta"]), justification: z.string() })),
  next_steps: z.array(z.string()), overall_level_suggestion: z.enum(["abaixo", "parcial", "atende", "supera"]),
});
export type InterviewAnalysis = z.infer<typeof analysisSchema>;

// Every caller must provide the authenticated client; authorization precedes privileged access, even for cached analysis.
export async function analyzeInterviewById(client: AuthenticatedClient, userId: string, interviewId: string, force = false): Promise<InterviewAnalysis> {
  const { orgId } = await requireInterviewAccess(client, userId, interviewId);
  const { data: itv, error } = await supabaseAdmin
    .from("interviews")
    .select("id, kind, notes, occurred_at, analysis, employee:employees(id, role:roles_catalog(title, rcf_items:rcf_items(title, kind, expected_level)))")
    .eq("id", interviewId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!itv) throw new Error("Entrevista não encontrada");

  // Return cached analysis if it already exists and not forcing
  if (!force && itv.analysis) return analysisSchema.parse(itv.analysis);

  const { data: answers, error: answersError } = await supabaseAdmin
    .from("interview_answers")
    .select("question, answer")
    .eq("interview_id", interviewId);

  if (answersError) throw new Error("Não foi possível consultar as respostas");
  const ctx = JSON.stringify(
    {
      tipo: itv.kind,
      ocorrida_em: itv.occurred_at,
      observacoes: itv.notes,
      cargo: itv.employee?.role,
      respostas: (answers ?? []).map((a) => ({ pergunta: a.question, resposta: a.answer })),
    },
    null,
    2,
  );

  const result = await callAIJson<InterviewAnalysis>({
    system:
      "Você é especialista em RH e entrevistas estruturadas. Analise a entrevista informada cruzando perguntas, respostas e o RCF do cargo. Identifique pontos fortes, preocupações, sinais por pergunta, gaps prováveis e próximos passos práticos. Português do Brasil, factual, sem generalidades.",
    user: `Contexto da entrevista:\n${ctx}`,
    toolName: "analyze_interview",
    toolDescription: "Análise estruturada da entrevista",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumo executivo em 2-3 frases" },
        strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        concerns: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
        signals: {
          type: "array", minItems: 1,
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              insight: { type: "string" },
              sentiment: { type: "string", enum: ["positivo", "neutro", "atencao"] },
            },
            required: ["question", "insight", "sentiment"],
          },
        },
        suggested_gaps: {
          type: "array", minItems: 0, maxItems: 5,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              severity: { type: "string", enum: ["baixa", "media", "alta"] },
              justification: { type: "string" },
            },
            required: ["title", "severity", "justification"],
          },
        },
        next_steps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        overall_level_suggestion: { type: "string", enum: ["abaixo", "parcial", "atende", "supera"] },
      },
      required: ["summary", "strengths", "concerns", "signals", "suggested_gaps", "next_steps", "overall_level_suggestion"],
    },
  });

  const validated = analysisSchema.parse(result);
  const { error: updateError } = await supabaseAdmin
    .from("interviews")
    .update({ analysis: validated, analyzed_at: new Date().toISOString() })
    .eq("id", interviewId).eq("org_id", orgId);
  if (updateError) throw new Error("Não foi possível salvar a análise");

  return validated;
}
