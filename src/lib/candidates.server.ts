import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

export type CandidateAnalysis = {
  summary: string;
  fit_score: number; // 0-100
  recommendation: "avancar" | "considerar" | "descartar";
  strengths: string[];
  concerns: string[];
  red_flags: string[];
  signals: Array<{ question: string; insight: string; sentiment: "positivo" | "neutro" | "atencao" }>;
  rcf_alignment: Array<{ competency: string; level: "abaixo" | "parcial" | "atende" | "supera"; evidence: string }>;
  interview_questions: string[]; // suggested follow-up questions for live interview
  next_steps: string[];
};

export async function analyzeCandidateInviteById(inviteId: string, force = false): Promise<CandidateAnalysis> {
  const { data: inv, error } = await supabaseAdmin
    .from("candidate_invites")
    .select("id, candidate_name, answers, notes, analysis, role:roles_catalog(title, summary, rcf_items:rcf_items(title, kind, expected_level, description))")
    .eq("id", inviteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) throw new Error("Convite não encontrado");
  if (!force && (inv as any).analysis) return (inv as any).analysis as CandidateAnalysis;
  if (!(inv as any).answers) throw new Error("Candidato ainda não respondeu");

  const ctx = JSON.stringify({
    candidato: (inv as any).candidate_name,
    cargo: (inv as any).role,
    respostas: (inv as any).answers,
    observacoes: (inv as any).notes,
  }, null, 2);

  const result = await callAIJson<CandidateAnalysis>({
    system:
      "Você é um recrutador sênior. Analise as respostas de um candidato externo (pré-contratação) cruzando com o RCF do cargo. Avalie fit, evidências por competência, red flags, e sugira perguntas para aprofundar na entrevista presencial. Português do Brasil, factual e objetivo.",
    user: `Contexto:\n${ctx}`,
    toolName: "analyze_candidate",
    toolDescription: "Análise estruturada do candidato",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumo executivo do perfil em 3-4 frases" },
        fit_score: { type: "number", minimum: 0, maximum: 100, description: "Aderência ao cargo (0-100)" },
        recommendation: { type: "string", enum: ["avancar", "considerar", "descartar"] },
        strengths: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
        concerns: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
        red_flags: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
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
        rcf_alignment: {
          type: "array", minItems: 0,
          items: {
            type: "object",
            properties: {
              competency: { type: "string" },
              level: { type: "string", enum: ["abaixo", "parcial", "atende", "supera"] },
              evidence: { type: "string" },
            },
            required: ["competency", "level", "evidence"],
          },
        },
        interview_questions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8, description: "Perguntas para aprofundar na entrevista ao vivo" },
        next_steps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
      },
      required: ["summary", "fit_score", "recommendation", "strengths", "concerns", "red_flags", "signals", "rcf_alignment", "interview_questions", "next_steps"],
    },
  });

  await supabaseAdmin
    .from("candidate_invites")
    .update({ analysis: result as any, analyzed_at: new Date().toISOString(), status: "analisado" })
    .eq("id", inviteId);

  return result;
}
