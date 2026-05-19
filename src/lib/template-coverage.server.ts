import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

const ALL_KINDS: Array<{ key: "selecao" | "feedback" | "desligamento" | "carreira"; label: string; focus: string }> = [
  { key: "selecao", label: "Seleção", focus: "entrevista de seleção para contratação, avaliando fit técnico, comportamental e cultural" },
  { key: "feedback", label: "Feedback", focus: "entrevista periódica de feedback, abordando entregas, comportamentos, percepções e próximos passos" },
  { key: "desligamento", label: "Desligamento", focus: "entrevista de desligamento, entendendo motivos, percepções sobre liderança, time, cultura e melhorias" },
  { key: "carreira", label: "Carreira", focus: "conversa de carreira, aspirações, expectativas, gaps percebidos e plano de desenvolvimento" },
];

export async function generateMissingTemplatesForRole(args: { roleId: string; title: string; departmentName?: string | null }) {
  const ctx = `Cargo: ${args.title}${args.departmentName ? ` (Setor: ${args.departmentName})` : ""}`;

  const { data: existing } = await supabaseAdmin
    .from("interview_templates")
    .select("kind")
    .eq("role_id", args.roleId);
  const have = new Set((existing ?? []).map((r: any) => r.kind));
  const missing = ALL_KINDS.filter((k) => !have.has(k.key));
  if (missing.length === 0) return { ok: true, generated: 0 };

  const rows: any[] = [];
  for (const k of missing) {
    const result = await callAIJson<{ questions: string[] }>({
      system: `Você é especialista em entrevistas estruturadas de RH. Gere de 8 a 12 perguntas abertas, específicas e acionáveis para uma ${k.focus}. Use o cargo como contexto. Português do Brasil. Evite perguntas genéricas ou sim/não.`,
      user: ctx,
      toolName: "generate_questions",
      toolDescription: `Perguntas para roteiro de ${k.label}`,
      parameters: {
        type: "object",
        properties: { questions: { type: "array", items: { type: "string" }, minItems: 6, maxItems: 14 } },
        required: ["questions"],
      },
    });
    rows.push({
      role_id: args.roleId,
      kind: k.key,
      title: `${k.label} — ${args.title}`,
      questions: (result.questions ?? []).map((q) => ({ question: q })),
    });
  }

  const { error } = await supabaseAdmin.from("interview_templates").insert(rows);
  if (error) throw new Error(`Falha ao salvar roteiros: ${error.message}`);
  return { ok: true, generated: rows.length };
}
