import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

export type ProcessStep = { title: string; how: string };
export type GeneratedProcess = {
  title: string;
  objective: string;
  steps: ProcessStep[];
  tools: string;
  success_criteria: string;
};

async function getCompanyContext() {
  const { data } = await supabaseAdmin
    .from("company_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const cnae = data?.cnae_code ?? "4744-0/05";
  const cnaeDesc = data?.cnae_description ?? "Comércio varejista de materiais de construção em geral";
  const segment = data?.segment ?? "Materiais de construção (varejo)";
  const name = data?.trade_name ?? data?.legal_name ?? "Empresa";
  return { cnae, cnaeDesc, segment, name };
}

export async function generateProcessesForRole(args: { roleId: string; replace?: boolean }) {
  const { data: role } = await supabaseAdmin
    .from("roles_catalog")
    .select("id, title, summary, department:departments(name), rcf_items(title, kind, expected_level)")
    .eq("id", args.roleId)
    .maybeSingle();
  if (!role) throw new Error("Cargo não encontrado");

  const company = await getCompanyContext();
  const ctx = `Empresa: ${company.name}
Segmento: ${company.segment}
CNAE: ${company.cnae} — ${company.cnaeDesc}

Cargo: ${(role as any).title}
Setor: ${(role as any).department?.name ?? "—"}
Resumo: ${(role as any).summary ?? "—"}
RCF do cargo: ${JSON.stringify((role as any).rcf_items ?? [], null, 2)}`;

  const result = await callAIJson<{ processes: GeneratedProcess[] }>({
    system: `Você é especialista em manuais operacionais (POPs) para empresas do varejo de materiais de construção no Brasil. Gere de 5 a 8 processos completos "como fazer", específicos para o cargo informado, totalmente aderentes ao CNAE da empresa. Use linguagem clara, instrutiva e prática (estilo manual passo a passo). Cada processo deve ter 6 a 12 etapas detalhadas, com o "como fazer" de cada uma (não apenas o que fazer). Considere realidades do setor: atendimento de balcão, vendas técnicas, separação/expedição, estoque, recebimento de mercadorias, conferência, montagem de orçamentos, pós-venda, entregas, etc. Português do Brasil.`,
    user: ctx,
    toolName: "generate_processes",
    toolDescription: "Lista de processos passo a passo para o cargo",
    parameters: {
      type: "object",
      properties: {
        processes: {
          type: "array",
          minItems: 5,
          maxItems: 8,
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              objective: { type: "string", description: "Objetivo do processo em 1-2 frases" },
              steps: {
                type: "array",
                minItems: 6,
                maxItems: 12,
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Nome curto da etapa" },
                    how: { type: "string", description: "Como fazer essa etapa, em detalhes acionáveis" },
                  },
                  required: ["title", "how"],
                },
              },
              tools: { type: "string", description: "Sistemas, formulários, EPIs, ferramentas e insumos necessários" },
              success_criteria: { type: "string", description: "Como saber que o processo foi executado corretamente" },
            },
            required: ["title", "objective", "steps", "tools", "success_criteria"],
          },
        },
      },
      required: ["processes"],
    },
  });

  if (args.replace) {
    await supabaseAdmin.from("role_processes").delete().eq("role_id", args.roleId);
  }

  const rows = (result.processes ?? []).map((p, idx) => ({
    role_id: args.roleId,
    title: p.title,
    objective: p.objective,
    steps: p.steps,
    tools: p.tools,
    success_criteria: p.success_criteria,
    sort_order: idx,
  }));
  if (rows.length) {
    const { error } = await supabaseAdmin.from("role_processes").insert(rows);
    if (error) throw new Error(`Falha ao salvar processos: ${error.message}`);
  }
  return { ok: true, count: rows.length };
}

export async function generateProcessesForAllMissing() {
  const { data: roles } = await supabaseAdmin.from("roles_catalog").select("id");
  const { data: existing } = await supabaseAdmin.from("role_processes").select("role_id");
  const have = new Set((existing ?? []).map((r: any) => r.role_id));
  const missing = (roles ?? []).filter((r: any) => !have.has(r.id));
  let total = 0;
  for (const r of missing) {
    const res = await generateProcessesForRole({ roleId: (r as any).id });
    total += res.count;
  }
  return { ok: true, rolesProcessed: missing.length, processesCreated: total };
}
