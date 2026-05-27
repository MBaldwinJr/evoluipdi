import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

export type CvAnalysis = {
  summary: string;
  fit_score: number;
  experience_years: number;
  recommendation: "avancar" | "considerar" | "descartar";
  highlights: string[];
  concerns: string[];
  rcf_alignment: Array<{ competency: string; level: "abaixo" | "parcial" | "atende" | "supera"; evidence: string }>;
  questions_to_ask: string[];
};

async function extractText(filename: string, bytes: Uint8Array): Promise<string> {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const { extractText } = await import("unpdf");
    const { text } = await extractText(bytes, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : (text as string);
  }
  if (lower.endsWith(".docx")) {
    const mammoth: any = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  }
  // fallback: tentar tratar como texto
  return new TextDecoder().decode(bytes);
}

export async function analyzeCandidateCv(inviteId: string, force = false): Promise<CvAnalysis> {
  const { data: inv, error } = await supabaseAdmin
    .from("candidate_invites")
    .select("id, candidate_name, cv_path, cv_filename, cv_analysis, role:roles_catalog(title, summary, rcf_items:rcf_items(title, kind, expected_level, description))")
    .eq("id", inviteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) throw new Error("Convite não encontrado");
  if (!force && (inv as any).cv_analysis) return (inv as any).cv_analysis as CvAnalysis;
  if (!(inv as any).cv_path) throw new Error("Currículo ainda não foi anexado");

  const { data: file, error: dlErr } = await supabaseAdmin.storage.from("candidate-cvs").download((inv as any).cv_path);
  if (dlErr || !file) throw new Error("Falha ao baixar currículo: " + (dlErr?.message ?? ""));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const raw = await extractText((inv as any).cv_filename ?? "cv", bytes);
  const text = raw.slice(0, 18000); // truncar para o modelo

  const ctx = JSON.stringify({
    candidato: (inv as any).candidate_name,
    cargo: (inv as any).role,
  });

  const result = await callAIJson<CvAnalysis>({
    system:
      "Você é um recrutador sênior. Analise o currículo a seguir comparando com o RCF do cargo. Extraia tempo de experiência, aderência às competências, pontos fortes, alertas e perguntas a aprofundar. Português do Brasil, factual.",
    user: `Contexto: ${ctx}\n\n--- CURRÍCULO ---\n${text}`,
    toolName: "analyze_cv",
    toolDescription: "Análise estruturada do currículo",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string" },
        fit_score: { type: "number", minimum: 0, maximum: 100 },
        experience_years: { type: "number", minimum: 0, maximum: 60 },
        recommendation: { type: "string", enum: ["avancar", "considerar", "descartar"] },
        highlights: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
        concerns: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 8 },
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
        questions_to_ask: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 8 },
      },
      required: ["summary", "fit_score", "experience_years", "recommendation", "highlights", "concerns", "rcf_alignment", "questions_to_ask"],
    },
  });

  await supabaseAdmin
    .from("candidate_invites")
    .update({ cv_analysis: result as any, cv_analyzed_at: new Date().toISOString() })
    .eq("id", inviteId);

  return result;
}
