import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function getEmployeeAiContext(employeeId: string) {
  const { data: emp } = await supabaseAdmin
    .from("employees")
    .select("*, role:roles_catalog(title, rcf_items:rcf_items(title, kind, expected_level))")
    .eq("id", employeeId)
    .maybeSingle();
  const { data: evals } = await supabaseAdmin
    .from("evaluations").select("overall_level, fact, impact, next_step, scores:evaluation_scores(observed_level, expected_level, rcf_item:rcf_items(title))")
    .eq("employee_id", employeeId).order("occurred_at", { ascending: false }).limit(5);
  const { data: fbs } = await supabaseAdmin
    .from("feedbacks").select("fact, impact, next_step, kind").eq("employee_id", employeeId).order("occurred_at", { ascending: false }).limit(20);

  return JSON.stringify({ role: (emp as any)?.role, evaluations: evals ?? [], feedbacks: fbs ?? [] }, null, 2);
}