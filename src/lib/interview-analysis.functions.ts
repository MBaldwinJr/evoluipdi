import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzeInterviewById } from "./interview-analysis.server";

async function assertInterviewAccess(userId: string, interviewId: string) {
  const { data: rh } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "rh").maybeSingle();
  if (rh) return;
  const { data: itv } = await supabaseAdmin
    .from("interviews")
    .select("conducted_by, employee:employees(user_id, manager_id)")
    .eq("id", interviewId)
    .maybeSingle();
  if (!itv) throw new Error("Entrevista não encontrada");
  if (itv.conducted_by === userId) return;
  const emp: any = (itv as any).employee;
  if (emp?.manager_id) {
    const { data: mgr } = await supabaseAdmin.from("employees").select("user_id").eq("id", emp.manager_id).maybeSingle();
    if (mgr?.user_id === userId) return;
  }
  throw new Error("Acesso negado a esta entrevista");
}

export const analyzeInterviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertInterviewAccess(context.userId, data.interviewId);
    return analyzeInterviewById(data.interviewId, data.force ?? false);
  });
