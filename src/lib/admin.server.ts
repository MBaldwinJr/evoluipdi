import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function assertRH(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "rh").maybeSingle();
  if (!data) throw new Error("Apenas o RH pode executar esta ação");
}

export async function createEmployeeUser(data: {
  email: string;
  password: string;
  fullName: string;
  roleId?: string | null;
  departmentId?: string | null;
  managerId?: string | null;
}) {
  const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
  if (existing) throw new Error("E-mail já cadastrado");
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: data.email, password: data.password, email_confirm: true,
    user_metadata: { full_name: data.fullName },
  });
  if (error) throw new Error(error.message);
  const newUid = created.user!.id;
  await supabaseAdmin.from("profiles").upsert({ id: newUid, email: data.email, full_name: data.fullName });
  const { error: e2 } = await supabaseAdmin.from("employees").insert({
    user_id: newUid, role_id: data.roleId ?? null, department_id: data.departmentId ?? null, manager_id: data.managerId ?? null,
  });
  if (e2) throw new Error(e2.message);
  return { ok: true, userId: newUid };
}

export async function replaceEmployeeRole(userId: string, role: "colaborador" | "gestor" | "rh") {
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  const { error } = await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function updateEmployee(
  employeeId: string,
  data: { fullName?: string; roleId?: string | null; departmentId?: string | null; managerId?: string | null },
) {
  const { data: emp, error: e0 } = await supabaseAdmin
    .from("employees").select("user_id").eq("id", employeeId).maybeSingle();
  if (e0 || !emp) throw new Error("Colaborador não encontrado");
  if (data.fullName !== undefined) {
    await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", emp.user_id);
  }
  const patch: { role_id?: string | null; department_id?: string | null; manager_id?: string | null } = {};
  if (data.roleId !== undefined) patch.role_id = data.roleId;
  if (data.departmentId !== undefined) patch.department_id = data.departmentId;
  if (data.managerId !== undefined) patch.manager_id = data.managerId;
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin.from("employees").update(patch).eq("id", employeeId);
    if (error) throw new Error(error.message);
  }
  return { ok: true };
}

export async function deleteEmployee(employeeId: string) {
  const { data: emp, error: e0 } = await supabaseAdmin
    .from("employees").select("user_id").eq("id", employeeId).maybeSingle();
  if (e0 || !emp) throw new Error("Colaborador não encontrado");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(emp.user_id);
  if (error) throw new Error(error.message);
  return { ok: true };
}