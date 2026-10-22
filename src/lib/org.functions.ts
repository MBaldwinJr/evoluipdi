import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgAccess, requireSuperAdmin } from "./security-access";
import { orgCreateInputSchema } from "./org-create-input";

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
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (superRow) {
      const { data: allOrgs, error } = await supabase
        .from("orgs")
        .select("id, legal_name, trade_name, cnpj, status, timezone, block_outside_geofence")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (allOrgs ?? []).map((o) => ({ ...o, roles: ["admin", "rh", "super_admin"] }));
    }

    const { data: members, error } = await supabase
      .from("org_members")
      .select(
        "org_id, role, orgs:org_id (id, legal_name, trade_name, cnpj, status, timezone, block_outside_geofence)",
      )
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const byOrg = new Map<
      string,
      {
        id: string;
        legal_name: string;
        trade_name: string | null;
        cnpj: string | null;
        status: string;
        timezone: string;
        block_outside_geofence: boolean;
        roles: string[];
      }
    >();
    for (const m of members ?? []) {
      const o = m.orgs;
      if (!o) continue;
      const existing = byOrg.get(o.id);
      if (existing) {
        existing.roles.push(m.role);
      } else {
        byOrg.set(o.id, { ...o, roles: [m.role] });
      }
    }
    return Array.from(byOrg.values());
  });

export const orgGetEntitlements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ org_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireOrgAccess(supabase, userId, data.org_id);
    const { data: plans, error } = await supabase
      .from("org_plans")
      .select("plan_code, modules, limits, valid_to")
      .eq("org_id", data.org_id)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const plan = plans?.[0];
    if (!plan)
      return {
        plan_code: "free" as string,
        modules: PLAN_MODULES.free,
        limits: {} as Record<string, number | string | boolean>,
      };
    return {
      plan_code: plan.plan_code as string,
      modules: (plan.modules ?? []) as string[],
      limits: (plan.limits ?? {}) as Record<string, number | string | boolean>,
    };
  });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const receitaSchema = z.object({
  razao_social: z.string().min(1),
  nome_fantasia: z.string().optional().nullable(),
  cnae_fiscal: z.union([z.string(), z.number()]).optional().nullable(),
  cnae_fiscal_descricao: z.string().optional().nullable(),
});

async function fetchCnpjReceita(digits: string): Promise<z.infer<typeof receitaSchema>> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal");
    if (res.status === 429) {
      await sleep(700 * (attempt + 1));
      continue;
    }
    if (!res.ok) break;
    return receitaSchema.parse(await res.json());
  }
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${digits}`);
    if (res.ok) {
      const j = z
        .object({
          status: z.string().optional(),
          message: z.string().optional(),
          nome: z.string(),
          fantasia: z.string().optional(),
          atividade_principal: z.array(z.object({ code: z.string(), text: z.string() })).optional(),
        })
        .parse(await res.json());
      if (j.status === "ERROR") throw new Error(j.message || "CNPJ não encontrado");
      const atividade = Array.isArray(j.atividade_principal) ? j.atividade_principal[0] : null;
      return {
        razao_social: j.nome,
        nome_fantasia: j.fantasia,
        cnae_fiscal: atividade?.code?.replace(/\D/g, ""),
        cnae_fiscal_descricao: atividade?.text,
      };
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("CNPJ")) throw e;
  }
  throw new Error(
    "Receita Federal está limitando consultas. Aguarde alguns segundos e tente novamente.",
  );
}

export const orgLookupCnpj = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ cnpj: z.string().min(11).max(20) }).parse(d))
  .handler(async ({ data }) => {
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) throw new Error("CNPJ inválido (14 dígitos)");
    const j = await fetchCnpjReceita(digits);
    const code = j.cnae_fiscal ? String(j.cnae_fiscal) : "";
    const formattedCnae =
      code.length === 7 ? `${code.slice(0, 4)}-${code.slice(4, 5)}/${code.slice(5, 7)}` : code;
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
  .inputValidator((d: unknown) => orgCreateInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const digits = data.cnpj.replace(/\D/g, "");
    if (digits.length !== 14) throw new Error("CNPJ inválido (14 dígitos)");
    const company = await fetchCnpjReceita(digits);
    const { hardeningRpcClient, assertRpcSuccess } = await import("./hardening-rpc.server");
    const { data: id, error } = await hardeningRpcClient.rpc("hardening_create_org", {
      actor_id: context.userId,
      company: { ...company, cnpj: digits, timezone: data.timezone },
    });
    assertRpcSuccess(error);
    if (!id) throw new Error("Não foi possível criar a empresa");
    return { id };
  });

export const orgUpdatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        org_id: z.string().uuid(),
        plan_code: z.enum(["free", "starter", "pro", "enterprise"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const { hardeningRpcClient, assertRpcSuccess } = await import("./hardening-rpc.server");
    const { error } = await hardeningRpcClient.rpc("hardening_update_plan", {
      actor_id: context.userId,
      target_org: data.org_id,
      new_plan: data.plan_code,
      new_modules: PLAN_MODULES[data.plan_code] ?? [],
    });
    assertRpcSuccess(error);
    return { ok: true };
  });

export { ALL_MODULES, PLAN_MODULES };
