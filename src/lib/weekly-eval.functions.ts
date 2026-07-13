import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserOrgId } from "./org.server";

export const listEmployeesForEvalFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const orgId = await getUserOrgId(context.userId);
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, role_id, role:roles_catalog(id, title)")
      .eq("org_id", orgId)
      .eq("active", true)
      .order("full_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getWeeklyEvalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employeeId: z.string().uuid(),
      weekStart: z.string(), // yyyy-mm-dd (segunda-feira)
      roleIdOverride: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const orgId = await getUserOrgId(context.userId);
    const { data: emp, error: eErr } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, role_id, role:roles_catalog(id, title)")
      .eq("id", data.employeeId)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!emp) throw new Error("Colaborador não encontrado");

    const { data: roles } = await supabaseAdmin
      .from("roles_catalog")
      .select("id, title")
      .eq("org_id", orgId)
      .order("title");

    const effectiveRoleId = data.roleIdOverride ?? emp.role_id;
    if (!effectiveRoleId) return { employee: emp, roles: roles ?? [], processes: [], evaluations: [] };

    const { data: processes, error: pErr } = await supabaseAdmin
      .from("role_processes")
      .select("id, title, objective, success_criteria, sort_order")
      .eq("role_id", effectiveRoleId)
      .order("sort_order");
    if (pErr) throw new Error(pErr.message);

    const { data: evals, error: vErr } = await supabaseAdmin
      .from("process_weekly_evaluations")
      .select("id, role_process_id, score, notes, evaluator_id, updated_at")
      .eq("employee_id", data.employeeId)
      .eq("week_start", data.weekStart);
    if (vErr) throw new Error(vErr.message);

    return { employee: emp, roles: roles ?? [], processes: processes ?? [], evaluations: evals ?? [] };
  });


export const saveWeeklyEvalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employeeId: z.string().uuid(),
      weekStart: z.string(),
      items: z.array(z.object({
        roleProcessId: z.string().uuid(),
        score: z.number().int().min(1).max(5),
        notes: z.string().max(2000).nullable().optional(),
      })),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const orgId = await getUserOrgId(context.userId);
    const rows = data.items.map((it) => ({
      org_id: orgId,
      employee_id: data.employeeId,
      evaluator_id: context.userId,
      role_process_id: it.roleProcessId,
      week_start: data.weekStart,
      score: it.score,
      notes: it.notes ?? null,
    }));
    if (rows.length === 0) return { ok: true, count: 0 };
    const { error } = await supabaseAdmin
      .from("process_weekly_evaluations")
      .upsert(rows, { onConflict: "employee_id,role_process_id,week_start" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const listWeeklyEvalHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ employeeId: z.string().uuid(), weeks: z.number().int().min(1).max(52).default(8) }).parse(d))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("process_weekly_evaluations")
      .select("week_start, score, role_process_id, role_process:role_processes(title)")
      .eq("employee_id", data.employeeId)
      .order("week_start", { ascending: false })
      .limit(data.weeks * 20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
