import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLAN_MODULES, ALL_MODULES } from "./org.functions";

async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito à plataforma");
}

export const platformListOrgs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId!);
    const { data: orgs, error } = await supabaseAdmin
      .from("orgs")
      .select("id, legal_name, trade_name, cnpj, status, trial_ends_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (orgs ?? []).map((o) => o.id);
    const [{ data: plans }, { data: subs }, { data: members }] = await Promise.all([
      supabaseAdmin.from("org_plans").select("org_id, plan_code, modules").eq("active", true).in("org_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("org_subscriptions").select("org_id, status, plan_code, current_period_end").in("org_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      supabaseAdmin.from("org_members").select("org_id, user_id").in("org_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    ]);

    const planByOrg = new Map((plans ?? []).map((p: any) => [p.org_id, p]));
    const subByOrg = new Map((subs ?? []).map((s: any) => [s.org_id, s]));
    const countByOrg = new Map<string, number>();
    for (const m of members ?? []) countByOrg.set(m.org_id, (countByOrg.get(m.org_id) ?? 0) + 1);

    return (orgs ?? []).map((o: any) => ({
      ...o,
      plan_code: (planByOrg.get(o.id) as any)?.plan_code ?? "free",
      modules: ((planByOrg.get(o.id) as any)?.modules ?? []) as string[],
      subscription_status: (subByOrg.get(o.id) as any)?.status ?? null,
      members_count: countByOrg.get(o.id) ?? 0,
    }));
  });

export const platformSetOrgStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ org_id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId!);
    const { error } = await supabaseAdmin.from("orgs").update({ status: data.status }).eq("id", data.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const platformSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      org_id: z.string().uuid(),
      plan_code: z.enum(["free", "starter", "pro", "enterprise"]),
      modules: z.array(z.string()).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.userId!);
    await supabaseAdmin.from("org_plans").update({ active: false }).eq("org_id", data.org_id).eq("active", true);
    const modules = data.modules ?? PLAN_MODULES[data.plan_code] ?? [];
    const invalid = modules.filter((m) => !(ALL_MODULES as readonly string[]).includes(m));
    if (invalid.length) throw new Error(`Módulos inválidos: ${invalid.join(", ")}`);
    const { error } = await supabaseAdmin.from("org_plans").insert({
      org_id: data.org_id,
      plan_code: data.plan_code,
      modules,
      active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { ALL_MODULES, PLAN_MODULES };
