import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

export async function scoreApplicationById(applicationId: string): Promise<void> {
  const { data: app, error } = await supabaseAdmin
    .from("applications")
    .select(
      "id, job:jobs(title,requirements,responsibilities,description,role_id), talent:talent_pool(full_name,summary,skills,years_experience,current_position,current_company)",
    )
    .eq("id", applicationId)
    .maybeSingle();
  if (error || !app?.job || !app?.talent) return;

  let kpi: Record<string, unknown> | null = null;
  if ((app.job as { role_id: string | null }).role_id) {
    const { data: k } = await supabaseAdmin
      .from("position_kpis")
      .select("*")
      .eq("role_id", (app.job as { role_id: string }).role_id)
      .maybeSingle();
    kpi = k;
  }

  const result = await callAIJson<{ score: number; summary: string; strengths: string; gaps: string }>({
    system:
      "Você é um especialista em recrutamento. Avalie o fit entre candidato e vaga em PT-BR com objetividade.",
    user: `VAGA:\n${JSON.stringify(app.job, null, 2)}\n\nKPIs DO CARGO:\n${
      kpi ? JSON.stringify(kpi, null, 2) : "—"
    }\n\nCANDIDATO:\n${JSON.stringify(app.talent, null, 2)}`,
    toolName: "score_application",
    toolDescription: "Calcula o fit do candidato com a vaga",
    parameters: {
      type: "object",
      properties: {
        score: { type: "number", description: "Pontuação 0-100" },
        summary: { type: "string", description: "Resumo (3-4 frases)" },
        strengths: { type: "string", description: "Pontos fortes" },
        gaps: { type: "string", description: "Lacunas" },
      },
      required: ["score", "summary", "strengths", "gaps"],
    },
  });

  const score = Math.max(0, Math.min(100, Math.round(result.score)));
  await supabaseAdmin
    .from("applications")
    .update({
      ai_fit_score: score,
      ai_fit_summary: `${result.summary}\n\nPontos fortes:\n${result.strengths}\n\nLacunas:\n${result.gaps}`,
    })
    .eq("id", applicationId);
}
