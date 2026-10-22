import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_LIMITS, type PlanLimits } from "./billing.functions";

async function getOrgPlanLimits(orgId: string): Promise<{ planCode: string; limits: PlanLimits; expired: boolean }> {
  const [{ data: org, error: orgError }, { data: sub, error: subError }, { data: plan, error: planError }] = await Promise.all([
    supabaseAdmin.from("orgs").select("trial_ends_at").eq("id", orgId).maybeSingle(),
    supabaseAdmin.from("org_subscriptions").select("status, plan_code").eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("org_plans").select("plan_code").eq("org_id", orgId).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (orgError || subError || planError || !org) throw new Error("Não foi possível validar o plano");
  const planCode = (sub?.plan_code as string) || (plan?.plan_code as string) || "free";
  const limits = PLAN_LIMITS[planCode] ?? PLAN_LIMITS.free;
  const trialEndsAt = (org?.trial_ends_at as string | null) ?? null;
  const inTrial = !!trialEndsAt && new Date(trialEndsAt).getTime() > Date.now();
  const active = sub?.status === "active" || sub?.status === "trialing";
  const expired = !active && !inTrial && !!sub;
  return { planCode, limits, expired };
}

export async function assertPlanActive(orgId: string) {
  const { expired } = await getOrgPlanLimits(orgId);
  if (expired) throw new Error("Seu plano expirou. Assine um plano em /billing para continuar.");
}

export async function assertCanAddEmployee(orgId: string) {
  const { limits, expired } = await getOrgPlanLimits(orgId);
  if (expired) throw new Error("Seu plano expirou. Assine em /billing para adicionar colaboradores.");
  if (limits.employees === -1) return;
  const { count, error } = await supabaseAdmin
    .from("employees").select("*", { count: "exact", head: true })
    .eq("org_id", orgId).eq("active", true);
  if (error || count === null) throw new Error("Não foi possível validar o limite do plano");
  if (count >= limits.employees) {
    throw new Error(`Limite do plano atingido (${limits.employees} colaboradores). Faça upgrade em /billing.`);
  }
}

export async function assertCanAddBranch(orgId: string) {
  const { limits, expired } = await getOrgPlanLimits(orgId);
  if (expired) throw new Error("Seu plano expirou. Assine em /billing para adicionar filiais.");
  if (limits.branches === -1) return;
  const { count, error } = await supabaseAdmin
    .from("pt_branches").select("*", { count: "exact", head: true })
    .eq("company_id", orgId).eq("active", true);
  if (error || count === null) throw new Error("Não foi possível validar o limite do plano");
  if (count >= limits.branches) {
    throw new Error(`Limite do plano atingido (${limits.branches} filiais). Faça upgrade em /billing.`);
  }
}
