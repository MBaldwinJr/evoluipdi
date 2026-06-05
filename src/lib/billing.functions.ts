import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlanLimits = {
  employees: number; // -1 = unlimited
  branches: number;
  storage_mb: number;
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: { employees: 5, branches: 1, storage_mb: 100 },
  starter: { employees: 25, branches: 3, storage_mb: 1024 },
  pro: { employees: 100, branches: 10, storage_mb: 5120 },
  enterprise: { employees: -1, branches: -1, storage_mb: -1 },
};

export const billingGetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: org }, { data: sub }, { data: plan }, { count: employeeCount }, { count: branchCount }] = await Promise.all([
      supabase.from("orgs").select("id, trial_ends_at, status").eq("id", data.org_id).single(),
      supabase.from("org_subscriptions").select("*").eq("org_id", data.org_id).maybeSingle(),
      supabase.from("org_plans").select("plan_code").eq("org_id", data.org_id).eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("employees").select("*", { count: "exact", head: true }).eq("org_id", data.org_id).eq("active", true),
      supabase.from("pt_branches").select("*", { count: "exact", head: true }).eq("company_id", data.org_id).eq("active", true),
    ]);

    const planCode = (sub?.plan_code as string) || (plan?.plan_code as string) || "free";
    const limits = PLAN_LIMITS[planCode] ?? PLAN_LIMITS.free;
    const trialEndsAt = org?.trial_ends_at as string | null;
    const now = Date.now();
    const trialMs = trialEndsAt ? new Date(trialEndsAt).getTime() - now : 0;
    const trialDaysLeft = Math.max(0, Math.ceil(trialMs / (1000 * 60 * 60 * 24)));
    const isInTrial = trialDaysLeft > 0 && (!sub?.status || sub.status === "trialing");
    const isExpired = !isInTrial && (!sub || ["canceled", "incomplete_expired"].includes(sub.status));

    return {
      plan_code: planCode,
      limits,
      usage: {
        employees: employeeCount ?? 0,
        branches: branchCount ?? 0,
      },
      subscription: sub
        ? {
            status: sub.status as string,
            current_period_end: sub.current_period_end as string | null,
            cancel_at_period_end: sub.cancel_at_period_end as boolean,
            interval: sub.interval as string | null,
          }
        : null,
      trial_ends_at: trialEndsAt,
      trial_days_left: trialDaysLeft,
      is_in_trial: isInTrial,
      is_expired: isExpired,
    };
  });

export const billingCreateCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      org_id: z.string().uuid(),
      plan_code: z.enum(["starter", "pro"]),
      interval: z.enum(["month", "year"]).default("month"),
    }).parse(d),
  )
  .handler(async () => {
    // Stripe ainda não habilitado neste projeto.
    // Quando habilitar, esta função criará uma Stripe Checkout Session e retornará a URL.
    throw new Error("Pagamento online ainda não está disponível. Entre em contato pelo /contato para ativar seu plano.");
  });

export const billingOpenPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Portal de pagamento ainda não está disponível.");
  });
