import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALL_MODULES = [
  "rh",
  "pdi",
  "entrevistas",
  "candidatos",
  "ponto",
  "relatorios",
  "jornada-avancada",
  "ia-assistente",
] as const;

const PLAN_MODULES: Record<string, string[]> = {
  free: ["rh"],
  starter: ["rh", "pdi", "entrevistas", "relatorios"],
  pro: ["rh", "pdi", "entrevistas", "candidatos", "ponto", "relatorios"],
  enterprise: [...ALL_MODULES],
};

export const orgListMine = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Super-admin: see every org
    const { data: superRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId!)
      .eq("role", "super_admin")
      .maybeSingle();

    if (superRow) {
      const { data: allOrgs, error } = await supabase
        .from("orgs")
        .select("id, legal_name, trade_name, cnpj, status, timezone, block_outside_geofence")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (allOrgs ?? []).map((o: any) => ({ ...o, roles: ["admin", "rh", "super_admin"] }));
    }

    const { data: members, error } = await supabase
      .from("org_members")
      .select("org_id, role, orgs:org_id (id, legal_name, trade_name, cnpj, status, timezone, block_outside_geofence)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const byOrg = new Map<string, { id: string; legal_name: string; trade_name: string | null; cnpj: string | null; status: string; timezone: string; block_outside_geofence: boolean; roles: string[] }>();
    for (const m of members ?? []) {
      const o = (m as any).orgs;
      if (!o) continue;
      const existing = byOrg.get(o.id);
      if (existing) {
        existing.roles.push((m as any).role);
      } else {
        byOrg.set(o.id, { ...o, roles: [(m as any).role] });
      }
    }
    return Array.from(byOrg.values());
  });

export const orgGetEntitlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: plans, error } = await supabase
      .from("org_plans")
      .select("plan_code, modules, limits, valid_to")
      .eq("org_id", data.org_id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const plan = plans?.[0];
    if (!plan) return { plan_code: "free" as string, modules: PLAN_MODULES.free, limits: {} as Record<string, number | string | boolean> };
    return {
      plan_code: plan.plan_code as string,
      modules: (plan.modules ?? []) as string[],
      limits: (plan.limits ?? {}) as Record<string, number | string | boolean>,
    };
  });

export const orgLookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cnpj: z.string().min(11).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) throw new Error("CNPJ inválido (14 dígitos)");
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado na Receita");
    if (!res.ok) throw new Error(`Falha ao consultar CNPJ (${res.status})`);
    const j = (await res.json()) as any;
    const code = j.cnae_fiscal ? String(j.cnae_fiscal) : "";
    const formattedCnae = code.length === 7 ? `${code.slice(0, 4)}-${code.slice(4, 5)}/${code.slice(5, 7)}` : code;
    return {
      cnpj: digits,
      legal_name: j.razao_social ?? "",
      trade_name: j.nome_fantasia ?? "",
      cnae_code: formattedCnae,
      cnae_description: j.cnae_fiscal_descricao ?? "",
      segment: j.cnae_fiscal_descricao ?? "",
      payload: j,
    };
  });

export const orgCreateFromCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      cnpj: z.string().min(11),
      plan_code: z.enum(["free", "starter", "pro", "enterprise"]).default("pro"),
      timezone: z.string().default("America/Sao_Paulo"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) throw new Error("CNPJ inválido");

    // Validate via Receita
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado na Receita");
    if (!res.ok) throw new Error(`Falha ao validar CNPJ (${res.status})`);
    const j = (await res.json()) as any;
    const code = j.cnae_fiscal ? String(j.cnae_fiscal) : "";
    const formattedCnae = code.length === 7 ? `${code.slice(0, 4)}-${code.slice(4, 5)}/${code.slice(5, 7)}` : code;

    // Check duplicate
    const { data: dup } = await supabase.from("orgs").select("id").eq("cnpj", digits).maybeSingle();
    if (dup) throw new Error("Já existe uma empresa cadastrada com este CNPJ");

    // Insert org
    const { data: created, error: insErr } = await supabase
      .from("orgs")
      .insert({
        legal_name: j.razao_social ?? "Empresa",
        trade_name: j.nome_fantasia ?? null,
        cnpj: digits,
        cnae_code: formattedCnae || null,
        cnae_description: j.cnae_fiscal_descricao ?? null,
        segment: j.cnae_fiscal_descricao ?? null,
        timezone: data.timezone,
        status: "trial",
        receita_validated_at: new Date().toISOString(),
        receita_payload: j,
        created_by: userId!,
      })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Self-membership as admin
    const { error: memErr } = await supabase
      .from("org_members")
      .insert({ org_id: created.id, user_id: userId!, role: "admin" });
    if (memErr) throw new Error(memErr.message);

    // Ensure global RH role so the creator has full access to RH features in their own org
    await supabase.from("user_roles").insert({ user_id: userId!, role: "rh" });

    // Initial plan
    const { error: planErr } = await supabase
      .from("org_plans")
      .insert({
        org_id: created.id,
        plan_code: data.plan_code,
        modules: PLAN_MODULES[data.plan_code] ?? PLAN_MODULES.pro,
        active: true,
      });
    if (planErr) throw new Error(planErr.message);

    return { id: created.id };
  });

export const orgUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      org_id: z.string().uuid(),
      plan_code: z.enum(["free", "starter", "pro", "enterprise"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Deactivate current plan
    await supabase.from("org_plans").update({ active: false }).eq("org_id", data.org_id).eq("active", true);
    const { error } = await supabase.from("org_plans").insert({
      org_id: data.org_id,
      plan_code: data.plan_code,
      modules: PLAN_MODULES[data.plan_code] ?? [],
      active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export { ALL_MODULES, PLAN_MODULES };
