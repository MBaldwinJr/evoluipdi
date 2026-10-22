import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export const setEmployeeManagerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        employeeId: z.string().uuid(),
        managerId: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireEmployeeAccess, requireEmployeeReferences } =
      await import("./employee-access.server");
    const actor = { client: context.supabase, userId: context.userId };
    const employee = await requireEmployeeAccess(actor, data.employeeId);
    await requireEmployeeReferences(employee.org_id, { managerId: data.managerId });
    const { error } = await context.supabase
      .from("employees")
      .update({ manager_id: data.managerId })
      .eq("id", data.employeeId)
      .eq("org_id", employee.org_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listOrgChartFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getUserOrgId } = await import("./org.server");
    const { requireOrgAccess } = await import("./security-access");
    const orgId = await getUserOrgId(context.userId);
    await requireOrgAccess(context.supabase, context.userId, orgId, ["admin", "rh"]);
    const supabaseAdmin = context.supabase;
    // Preserve the existing first-org contract.
    const { data: m, error: memberError } = await supabaseAdmin
      .from("org_members")
      .select("org_id")
      .eq("user_id", context.userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (memberError) throw new Error("Não foi possível carregar a empresa");
    if (!m)
      return [] as Array<{
        id: string;
        full_name: string;
        role_title: string | null;
        department: string | null;
        avatar_url: string | null;
        manager_id: string | null;
      }>;
    const { data: emps, error: employeeError } = await supabaseAdmin
      .from("employees")
      .select(
        "id, manager_id, full_name, role_id, department_id, user_id, profile:profiles(full_name, avatar_url), role:roles_catalog(title), dept:departments(name)",
      )
      .eq("org_id", m.org_id)
      .eq("active", true);
    if (employeeError) throw new Error("Não foi possível carregar o organograma");
    return (emps ?? []).map((e) => ({
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
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        fullName: z.string().min(1).max(200),
        roleId: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        managerId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { createEmployeeUser } = await import("./admin.server");
    return createEmployeeUser(
      { ...data, createdByUserId: context.userId },
      { client: context.supabase, userId: context.userId },
    );
  });

export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["colaborador", "gestor", "rh"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { replaceEmployeeRole } = await import("./admin.server");
    const { getUserOrgId } = await import("./org.server");
    const orgId = await getUserOrgId(context.userId);
    return replaceEmployeeRole(data.userId, data.role, orgId, {
      client: context.supabase,
      userId: context.userId,
    });
  });

export const updateEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        employeeId: z.string().uuid(),
        fullName: z.string().min(1).max(200).optional(),
        roleId: z.string().uuid().nullable().optional(),
        departmentId: z.string().uuid().nullable().optional(),
        managerId: z.string().uuid().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { updateEmployee } = await import("./admin.server");
    const { employeeId, ...rest } = data;
    return updateEmployee(employeeId, rest, { client: context.supabase, userId: context.userId });
  });

export const deleteEmployeeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ employeeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { deleteEmployee } = await import("./admin.server");
    return deleteEmployee(data.employeeId, { client: context.supabase, userId: context.userId });
  });
