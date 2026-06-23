import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIJson } from "./ai.server";

export type JobArtCopy = {
  instagram: string;
  facebook: string;
  linkedin: string;
  whatsapp: string;
  hashtags: string[];
  headline: string;
  subhead: string;
  cta: string;
};

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
        "Você é um copywriter especialista em recrutamento e mídias sociais brasileiras. Crie textos curtos, persuasivos, com emojis pontuais e adequados a cada rede. Sem clichês corporativos.",
      user: `Crie textos de divulgação para a vaga:\n\nEmpresa: ${company}\nCargo: ${(job as any).title}\nDepartamento: ${(job as any).department?.name ?? "—"}\nLocal: ${(job as any).location ?? "—"}\nModelo: ${(job as any).work_model}\nContrato: ${(job as any).employment_type}\nSalário: ${(job as any).salary_min ?? "—"} a ${(job as any).salary_max ?? "—"}\nBenefícios: ${JSON.stringify((job as any).benefits ?? [])}\nDescrição: ${(job as any).description ?? "—"}\n\nKPIs do cargo:\n${kpi ? JSON.stringify(kpi, null, 2) : "—"}`,
      toolName: "generate_job_copy",
      toolDescription: "Gera copies para divulgar a vaga em redes sociais",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "Manchete curta para arte (até 6 palavras)" },
          subhead: { type: "string", description: "Subtítulo curto para arte (até 12 palavras)" },
          cta: { type: "string", description: "Chamada para ação curta (ex: 'Candidate-se já')" },
          instagram: { type: "string", description: "Legenda completa para Instagram (até 600 caracteres) com emojis" },
          facebook: { type: "string", description: "Post para Facebook (até 800 caracteres)" },
          linkedin: { type: "string", description: "Post para LinkedIn (até 1200 caracteres, tom profissional)" },
          whatsapp: { type: "string", description: "Mensagem curta para WhatsApp/Status (até 400 caracteres)" },
          hashtags: {
            type: "array",
            items: { type: "string" },
            description: "5 a 10 hashtags sem o caractere #",
          },
        },
        required: ["headline", "subhead", "cta", "instagram", "facebook", "linkedin", "whatsapp", "hashtags"],
      },
    });
  });
