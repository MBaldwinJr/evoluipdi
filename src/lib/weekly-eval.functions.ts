import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireOrgAccess } from "./security-access";


export const listEmployeesForEvalFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getUserOrgId } = await import("./org.server");
    const orgId = await getUserOrgId(context.userId);
    await requireOrgAccess(context.supabase, context.userId, orgId, ["admin", "rh", "gestor", "supervisor"]);
    const supabaseAdmin = context.supabase;
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, user_id, role_id, role:roles_catalog(id, title), profile:profiles!employees_user_id_profiles_fkey(full_name)")
      .eq("org_id", orgId)
      .eq("active", true);
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((e) => ({
      ...e,
      full_name: e.full_name || e.profile?.full_name || "(sem nome)",
    }));
    rows.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    return rows;
  });

export const getWeeklyEvalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employeeId: z.string().uuid(),
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // yyyy-mm-dd (segunda-feira)
      roleIdOverride: z.string().uuid().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { getUserOrgId } = await import("./org.server");
    const orgId = await getUserOrgId(context.userId);
    await requireOrgAccess(context.supabase, context.userId, orgId, ["admin", "rh", "gestor", "supervisor"]);
    const supabaseAdmin = context.supabase;
    const { data: emp, error: eErr } = await supabaseAdmin
      .from("employees")
      .select("id, full_name, role_id, role:roles_catalog(id, title)")
      .eq("id", data.employeeId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (eErr) throw new Error(eErr.message);
    if (!emp) throw new Error("Colaborador não encontrado");

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("roles_catalog")
      .select("id, title")
      .eq("org_id", orgId)
      .order("title");

    if (rolesError) throw new Error("Não foi possível consultar cargos");
    const effectiveRoleId = data.roleIdOverride ?? emp.role_id;
    if (!effectiveRoleId) return { employee: emp, roles: roles ?? [], processes: [], evaluations: [] };

    if (!roles?.some((role) => role.id === effectiveRoleId)) throw new Error("Cargo não pertence à empresa");
    const { data: processes, error: pErr } = await supabaseAdmin
      .from("role_processes")
      .select("id, title, objective, success_criteria, sort_order")
      .eq("role_id", effectiveRoleId).eq("org_id", orgId)
      .order("sort_order");
    if (pErr) throw new Error(pErr.message);

    const { data: evals, error: vErr } = await supabaseAdmin
      .from("process_weekly_evaluations")
      .select("id, role_process_id, score, notes, evaluator_id, updated_at")
      .eq("employee_id", data.employeeId).eq("org_id", orgId)
      .eq("week_start", data.weekStart);
    if (vErr) throw new Error(vErr.message);

    return { employee: emp, roles: roles ?? [], processes: processes ?? [], evaluations: evals ?? [] };
  });


export const saveWeeklyEvalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employeeId: z.string().uuid(),
      weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      items: z.array(z.object({
        roleProcessId: z.string().uuid(),
        score: z.number().int().min(1).max(5),
        notes: z.string().max(2000).nullable().optional(),
      })),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getUserOrgId } = await import("./org.server");
    const orgId = await getUserOrgId(context.userId);
    await requireOrgAccess(context.supabase, context.userId, orgId, ["admin", "rh", "gestor", "supervisor"]);
    const supabaseAdmin = context.supabase;
    const { data: employee, error: employeeError } = await context.supabase.from("employees").select("id").eq("id", data.employeeId).eq("org_id", orgId).maybeSingle();
    if (employeeError || !employee) throw new Error("Colaborador não encontrado ou acesso negado");
    const { data: manager, error: managerError } = await context.supabase.rpc("is_manager_of_emp", { _user_id: context.userId, _employee_id: data.employeeId });
    if (managerError) throw new Error("Não foi possível verificar o avaliador");
    if (!manager) await requireOrgAccess(context.supabase, context.userId, orgId, ["admin", "rh"]);
    const processIds = data.items.map((item) => item.roleProcessId);
    if (processIds.length) {
      const { data: processes, error } = await context.supabase.from("role_processes").select("id").eq("org_id", orgId).in("id", processIds);
      if (error || new Set(processes?.map((process) => process.id)).size !== new Set(processIds).size) throw new Error("Processo não pertence à empresa");
    }
    const rows = data.items.map((it) => ({
      org_id: orgId,
      employee_id: data.employeeId,
      role_process_id: it.roleProcessId,
      week_start: data.weekStart,
      score: it.score,
      notes: it.notes ?? null,
    }));
    if (rows.length === 0) return { ok: true, count: 0 };
    // Preserve original evaluator identity when updating an existing evaluation.
    for (const row of rows) {
      const { data: existing, error: readError } = await context.supabase.from("process_weekly_evaluations").select("id").eq("org_id", orgId).eq("employee_id", row.employee_id).eq("role_process_id", row.role_process_id).eq("week_start", row.week_start).maybeSingle();
      if (readError) throw new Error("Não foi possível consultar a avaliação");
      const result = existing
        ? await context.supabase.from("process_weekly_evaluations").update({ score: row.score, notes: row.notes }).eq("id", existing.id).eq("org_id", orgId).select("id").single()
        : await context.supabase.from("process_weekly_evaluations").insert({ ...row, evaluator_id: context.userId }).select("id").single();
      if (result.error) throw new Error("Não foi possível salvar a avaliação");
    }
    return { ok: true, count: rows.length };
  });

export const listWeeklyEvalHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ employeeId: z.string().uuid(), weeks: z.number().int().min(1).max(52).default(8) }).parse(d))
  .handler(async ({ data, context }) => {
    const { getUserOrgId } = await import("./org.server");
    const orgId = await getUserOrgId(context.userId);
    await requireOrgAccess(context.supabase, context.userId, orgId, ["admin", "rh", "gestor", "supervisor"]);
    const supabaseAdmin = context.supabase;
    const { data: rows, error } = await supabaseAdmin
      .from("process_weekly_evaluations")
      .select("week_start, score, role_process_id, role_process:role_processes(title)")
      .eq("employee_id", data.employeeId).eq("org_id", orgId)
      .order("week_start", { ascending: false })
      .limit(data.weeks * 20);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
