import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIJson } from "./ai.server";

export interface ReelsScript {
  readonly script: string;
  readonly storyboard: readonly string[];
  readonly caption: string;
  readonly cta: string;
}

export interface JobArtCopy {
  readonly headline: string;
  readonly subhead: string;
  readonly cta: string;
  readonly titleOptimized: string;
  readonly instagram: string;
  readonly facebook: string;
  readonly linkedin: string;
  readonly whatsapp: string;
  readonly sponsoredAd: string;
  readonly hashtags: readonly string[];
  readonly reels: ReelsScript;
}

export const generateJobCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ jobId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<JobArtCopy> => {
    const { supabase } = context;
    const { data: job, error } = await supabase
      .from("jobs")
      .select(
        "title, location, work_model, employment_type, salary_min, salary_max, benefits, requirements, description, department:departments(name), role:roles_catalog(id, title), org:orgs(trade_name, legal_name)",
      )
      .eq("id", data.jobId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Vaga não encontrada");

    let kpi: Record<string, unknown> | null = null;
    if ((job as any).role?.id) {
      const { data: row } = await supabase
        .from("position_kpis")
        .select("*")
        .eq("role_id", (job as any).role.id)
        .maybeSingle();
      kpi = row;
    }

    const company = (job as any).org?.trade_name ?? (job as any).org?.legal_name ?? "";

    return callAIJson<JobArtCopy>({
      system:
        "Você é um copywriter sênior de recrutamento e mídias sociais brasileiras. Escreva textos curtos, persuasivos, com emojis pontuais e tom adequado a cada rede. Sem clichês corporativos. Aproveite KPIs, certificações obrigatórias e competências como diferenciais da vaga.",
      user: `Crie materiais completos de divulgação para a vaga:\n\nEmpresa: ${company}\nCargo: ${(job as any).title}\nDepartamento: ${(job as any).department?.name ?? "—"}\nLocal: ${(job as any).location ?? "—"}\nModelo: ${(job as any).work_model}\nContrato: ${(job as any).employment_type}\nSalário: ${(job as any).salary_min ?? "—"} a ${(job as any).salary_max ?? "—"}\nBenefícios: ${JSON.stringify((job as any).benefits ?? [])}\nRequisitos: ${(job as any).requirements ?? "—"}\nDescrição: ${(job as any).description ?? "—"}\n\nKPIs / certificações / competências do cargo:\n${kpi ? JSON.stringify(kpi, null, 2) : "—"}`,
      toolName: "generate_job_marketing",
      toolDescription: "Gera kit completo de divulgação da vaga",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Manchete curta para arte (até 6 palavras)" },
          subhead: { type: "string", description: "Subtítulo curto para arte (até 12 palavras)" },
          cta: { type: "string", description: "Chamada para ação curta (ex: 'Candidate-se já')" },
          titleOptimized: { type: "string", description: "Título otimizado para SEO/listagem (até 80 caracteres)" },
          instagram: { type: "string", description: "Legenda Instagram (até 600 caracteres) com emojis" },
          facebook: { type: "string", description: "Post Facebook (até 800 caracteres)" },
          linkedin: { type: "string", description: "Post LinkedIn (até 1200 caracteres, tom profissional)" },
          whatsapp: { type: "string", description: "Mensagem WhatsApp/Status (até 400 caracteres)" },
          sponsoredAd: { type: "string", description: "Texto curto para anúncio patrocinado (até 200 caracteres) com gancho forte" },
          hashtags: {
            type: "array",
            items: { type: "string" },
            description: "5 a 10 hashtags sem o caractere #",
          },
          reels: {
            type: "object",
            description: "Roteiro de Reels/Shorts de 15 segundos baseado nos KPIs",
            properties: {
              script: { type: "string", description: "Roteiro narrado de 15s, com falas separadas por '/'" },
              storyboard: {
                type: "array",
                items: { type: "string" },
                description: "3 a 5 cenas descritas brevemente (visual + ação)",
              },
              caption: { type: "string", description: "Legenda do Reels (até 300 caracteres)" },
              cta: { type: "string", description: "CTA específico do Reels" },
            },
            required: ["script", "storyboard", "caption", "cta"],
          },
        },
        required: [
          "headline", "subhead", "cta", "titleOptimized",
          "instagram", "facebook", "linkedin", "whatsapp",
          "sponsoredAd", "hashtags", "reels",
        ],
      },
    });
  });
