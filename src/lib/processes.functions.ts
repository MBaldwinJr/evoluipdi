import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRH } from "./admin.server";
import { getUserOrgId } from "./org.server";
import { generateProcessesForRole, generateProcessesForAllMissing } from "./processes.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";


export const generateProcessesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ roleId: z.string().uuid(), replace: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    return generateProcessesForRole(data);
  });

export const generateAllMissingProcessesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRH(context.userId);
    return generateProcessesForAllMissing();
  });

const stepSchema = z.object({ title: z.string().min(1).max(300), how: z.string().min(1).max(4000) });

export const upsertProcessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      roleId: z.string().uuid(),
      title: z.string().min(1).max(300),
      objective: z.string().max(2000).nullable().optional(),
      tools: z.string().max(2000).nullable().optional(),
      success_criteria: z.string().max(2000).nullable().optional(),
      steps: z.array(stepSchema).max(40),
      sort_order: z.number().int().min(0).max(999).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    if (data.id) {
      const { error } = await supabaseAdmin.from("role_processes").update({
        title: data.title,
        objective: data.objective ?? null,
        tools: data.tools ?? null,
        success_criteria: data.success_criteria ?? null,
        steps: data.steps,
        sort_order: data.sort_order ?? 0,
      }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabaseAdmin.from("role_processes").insert({
      role_id: data.roleId,
      title: data.title,
      objective: data.objective ?? null,
      tools: data.tools ?? null,
      success_criteria: data.success_criteria ?? null,
      steps: data.steps,
      sort_order: data.sort_order ?? 0,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins!.id };
  });

export const deleteProcessFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    const { error } = await supabaseAdmin.from("role_processes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveCompanySettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      legal_name: z.string().max(300).nullable().optional(),
      trade_name: z.string().max(300).nullable().optional(),
      cnpj: z.string().max(20).nullable().optional(),
      cnae_code: z.string().max(20).nullable().optional(),
      cnae_description: z.string().max(500).nullable().optional(),
      segment: z.string().max(300).nullable().optional(),
      notes: z.string().max(4000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    const payload = {
      legal_name: data.legal_name ?? null,
      trade_name: data.trade_name ?? null,
      cnpj: data.cnpj ?? null,
      cnae_code: data.cnae_code ?? null,
      cnae_description: data.cnae_description ?? null,
      segment: data.segment ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabaseAdmin.from("company_settings").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: existing } = await supabaseAdmin
      .from("company_settings").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin.from("company_settings").update(payload).eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: existing.id };
    }
    const { data: ins, error } = await supabaseAdmin.from("company_settings").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins!.id };
  });
