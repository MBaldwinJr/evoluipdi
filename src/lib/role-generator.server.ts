import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

export async function generateRoleContent(args: { roleId: string; title: string; departmentName?: string | null }) {
  const ctx = `Cargo: ${args.title}${args.departmentName ? ` (Setor: ${args.departmentName})` : ""}`;

  // 1) RCF items
  const rcf = await callAIJson<{
    items: Array<{ title: string; kind: "responsabilidade" | "competencia_tecnica" | "competencia_comportamental" | "indicador"; expected_level: number; description?: string }>;
  }>({
    system: "Você é especialista em gestão de pessoas e desenho de cargos. Para o cargo informado, gere uma lista enxuta e específica de itens de RCF (Responsabilidades, Competências e Funções). Mínimo 10 e máximo 16 itens cobrindo: 4-6 responsabilidades, 3-5 competências técnicas, 2-3 comportamentais e 1-2 indicadores. Português do Brasil, sem generalidades.",
    user: ctx,
    toolName: "generate_rcf",
    toolDescription: "Lista de itens RCF para o cargo",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              kind: { type: "string", enum: ["responsabilidade", "competencia_tecnica", "competencia_comportamental", "indicador"] },
              expected_level: { type: "integer", minimum: 1, maximum: 5 },
              description: { type: "string" },
            },
            required: ["title", "kind", "expected_level"],
          },
        },
      },
      required: ["items"],
    },
  });

  if (rcf.items?.length) {
    const rows = rcf.items.map((it, idx) => ({
      role_id: args.roleId,
      title: it.title,
      kind: it.kind,
      expected_level: it.expected_level,
      description: it.description ?? null,
      sort_order: idx,
    }));
    const { error } = await supabaseAdmin.from("rcf_items").insert(rows);
    if (error) throw new Error(`Falha ao salvar RCF: ${error.message}`);
  }

  // 2) Interview templates - 4 kinds
  const kinds: Array<{ key: "selecao" | "feedback" | "desligamento" | "carreira"; label: string; focus: string }> = [
    { key: "selecao", label: "Seleção", focus: "entrevista de seleção para contratação, avaliando fit técnico, comportamental e cultural" },
    { key: "feedback", label: "Feedback", focus: "entrevista periódica de feedback, abordando entregas, comportamentos, percepções e próximos passos" },
    { key: "desligamento", label: "Desligamento", focus: "entrevista de desligamento, entendendo motivos, percepções sobre liderança, time, cultura e melhorias" },
    { key: "carreira", label: "Carreira", focus: "conversa de carreira, aspirações, expectativas, gaps percebidos e plano de desenvolvimento" },
  ];

  const templateRows: any[] = [];
  for (const k of kinds) {
    const result = await callAIJson<{ questions: string[] }>({
      system: `Você é especialista em entrevistas estruturadas de RH. Gere de 8 a 12 perguntas abertas, específicas e acionáveis para uma ${k.focus}. Use o cargo como contexto para tornar as perguntas relevantes. Português do Brasil. Evite perguntas genéricas ou sim/não.`,
      user: ctx,
      toolName: "generate_questions",
      toolDescription: `Perguntas para roteiro de ${k.label}`,
      parameters: {
        type: "object",
        properties: { questions: { type: "array", items: { type: "string" }, minItems: 6, maxItems: 14 } },
        required: ["questions"],
      },
    });
    templateRows.push({
      role_id: args.roleId,
      kind: k.key,
      title: `${k.label} — ${args.title}`,
      questions: (result.questions ?? []).map((q) => ({ question: q })),
    });
  }

  if (templateRows.length) {
    const { error } = await supabaseAdmin.from("interview_templates").insert(templateRows);
    if (error) throw new Error(`Falha ao salvar roteiros: ${error.message}`);
  }

  return { ok: true, rcfCount: rcf.items?.length ?? 0, templateCount: templateRows.length };
}
