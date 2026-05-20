import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

export type InterviewAnalysis = {
  summary: string;
  strengths: string[];
  concerns: string[];
  signals: Array<{ question: string; insight: string; sentiment: "positivo" | "neutro" | "atencao" }>;
  suggested_gaps: Array<{ title: string; severity: "baixa" | "media" | "alta"; justification: string }>;
  next_steps: string[];
  overall_level_suggestion: "abaixo" | "parcial" | "atende" | "supera";
};

export async function analyzeInterviewById(interviewId: string, force = false): Promise<InterviewAnalysis> {
  const { data: itv, error } = await supabaseAdmin
    .from("interviews")
    .select("id, kind, notes, occurred_at, analysis, employee:employees(id, role:roles_catalog(title, rcf_items:rcf_items(title, kind, expected_level)))")
    .eq("id", interviewId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!itv) throw new Error("Entrevista não encontrada");

  // Return cached analysis if it already exists and not forcing
  if (!force && (itv as any).analysis) return (itv as any).analysis as InterviewAnalysis;

  const { data: answers } = await supabaseAdmin
    .from("interview_answers")
    .select("question, answer")
    .eq("interview_id", interviewId);

  const ctx = JSON.stringify(
    {
      tipo: (itv as any).kind,
      ocorrida_em: (itv as any).occurred_at,
      observacoes: (itv as any).notes,
      cargo: (itv as any).employee?.role,
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

  await supabaseAdmin
    .from("interviews")
    .update({ analysis: result as any, analyzed_at: new Date().toISOString() })
    .eq("id", interviewId);

  return result;
}
