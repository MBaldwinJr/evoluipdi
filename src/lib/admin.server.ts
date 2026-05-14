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