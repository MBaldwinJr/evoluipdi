import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { assertRH, createEmployeeUser, replaceEmployeeRole, updateEmployee, deleteEmployee } from "./admin.server";

export const setEmployeeManagerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      employeeId: z.string().uuid(),
      managerId: z.string().uuid().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    const { error } = await supabaseAdmin.rpc("set_employee_manager", {
      _employee_id: data.employeeId,
      _manager_id: data.managerId as any,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOrgChartFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertRH(context.userId);
    // pick first org of user
    const { data: m } = await supabaseAdmin
      .from("org_members").select("org_id").eq("user_id", context.userId).order("created_at").limit(1).maybeSingle();
    if (!m) return [] as Array<{ id: string; full_name: string; role_title: string | null; department: string | null; avatar_url: string | null; manager_id: string | null }>;
    const { data: emps } = await supabaseAdmin
      .from("employees")
      .select("id, manager_id, full_name, role_id, department_id, user_id, profile:profiles(full_name, avatar_url), role:roles_catalog(title), dept:departments(name)")
      .eq("org_id", m.org_id)
      .eq("active", true);
    return (emps ?? []).map((e: any) => ({
      id: e.id,
      manager_id: e.manager_id,
      full_name: e.full_name || e.profile?.full_name || "—",
      role_title: e.role?.title ?? null,
      department: e.dept?.name ?? null,
      avatar_url: e.profile?.avatar_url ?? null,
    }));
  });


export const createUserAndEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().min(1).max(200),
    roleId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    return createEmployeeUser({ ...data, createdByUserId: context.userId });
  });

export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["colaborador","gestor","rh"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    return replaceEmployeeRole(data.userId, data.role);
  });

export const updateEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    employeeId: z.string().uuid(),
    fullName: z.string().min(1).max(200).optional(),
    roleId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    const { employeeId, ...rest } = data;
    return updateEmployee(employeeId, rest);
  });

export const deleteEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    return deleteEmployee(data.employeeId);
  });
