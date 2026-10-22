import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserOrgId } from "./org.server";
import { assertCanAddEmployee } from "./plan-limits.server";
import { normalizeEmail, requireOrgAccess } from "./security-access";
import { requireEmployeeAccess, requireEmployeeReferences, type EmployeeActor } from "./employee-access.server";

export async function assertRH(userId: string) {
  const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "rh").maybeSingle();
  if (error || !data) throw new Error("Apenas o RH pode executar esta ação");
}

export async function createEmployeeUser(data: {
  email: string; password: string; fullName: string;
  roleId?: string | null; departmentId?: string | null; managerId?: string | null;
  createdByUserId: string; orgId?: string;
}, actor: EmployeeActor) {
  if (data.createdByUserId !== actor.userId) throw new Error("Acesso negado");
  const orgId = data.orgId ?? (await getUserOrgId(actor.userId));
  await requireOrgAccess(actor.client, actor.userId, orgId, ["admin", "rh"]);
  await assertCanAddEmployee(orgId);
  await requireEmployeeReferences(orgId, data);
  const email = normalizeEmail(data.email);
  const { data: existing, error: lookupError } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (lookupError) throw new Error("Não foi possível verificar o e-mail");
  if (existing) throw new Error("E-mail já cadastrado");
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email, password: data.password, email_confirm: true, user_metadata: { full_name: data.fullName },
  });
  if (error || !created.user) throw new Error("Não foi possível criar o usuário");
  const newUid = created.user.id;
  try {
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({ id: newUid, email, full_name: data.fullName });
    if (profileError) throw profileError;
    const { error: employeeError } = await supabaseAdmin.from("employees").insert({
      user_id: newUid, role_id: data.roleId ?? null, department_id: data.departmentId ?? null,
      manager_id: data.managerId ?? null, org_id: orgId,
    });
    if (employeeError) throw employeeError;
    const { error: memberError } = await supabaseAdmin.from("org_members").insert({ org_id: orgId, user_id: newUid, role: "colaborador" });
    if (memberError) throw memberError;
    return { ok: true, userId: newUid };
  } catch {
    // Membership has no Auth FK; remove it explicitly before deleting Auth.
    const { error: memberCleanup } = await supabaseAdmin.from("org_members").delete().eq("org_id", orgId).eq("user_id", newUid);
    const { error: employeeCleanup } = await supabaseAdmin.from("employees").delete().eq("org_id", orgId).eq("user_id", newUid);
    const { error: authCleanup } = await supabaseAdmin.auth.admin.deleteUser(newUid);
    if (memberCleanup || employeeCleanup || authCleanup) throw new Error("Cadastro falhou; a compensação requer revisão administrativa");
    throw new Error("Cadastro não concluído; usuário criado foi removido");
  }
}

export async function replaceEmployeeRole(userId: string, role: "colaborador" | "gestor" | "rh", orgId: string, actor: EmployeeActor) {
  await requireOrgAccess(actor.client, actor.userId, orgId, ["admin", "rh"]);
  const { data: members, error } = await actor.client.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId);
  if (error || !members?.length) throw new Error("Usuário não pertence à empresa");
  // Global and independent roles (including super_admin) are never deleted.
  const { error: insertError } = await supabaseAdmin.from("org_members").upsert({ org_id: orgId, user_id: userId, role }, { onConflict: "org_id,user_id,role" });
  if (insertError) throw new Error("Não foi possível definir o papel");
  const { error: deleteError } = await supabaseAdmin.from("org_members").delete().eq("org_id", orgId).eq("user_id", userId).in("role", ["colaborador", "gestor", "rh"]).neq("role", role);
  if (deleteError) throw new Error("Não foi possível substituir o papel anterior");
  return { ok: true };
}

export async function updateEmployee(employeeId: string, data: { fullName?: string; roleId?: string | null; departmentId?: string | null; managerId?: string | null }, actor: EmployeeActor) {
  const emp = await requireEmployeeAccess(actor, employeeId);
  await requireEmployeeReferences(emp.org_id, data);
  if (data.fullName !== undefined && emp.user_id) {
    // A profile is global: tenant HR must not rewrite an identity shared with another org.
    const { data: otherMembership, error } = await supabaseAdmin.from("org_members").select("id").eq("user_id", emp.user_id).neq("org_id", emp.org_id).limit(1);
    if (error || otherMembership?.length) throw new Error("Perfil compartilhado deve ser alterado pelo titular");
    const { error: profileError } = await supabaseAdmin.from("profiles").update({ full_name: data.fullName }).eq("id", emp.user_id);
    if (profileError) throw new Error("Não foi possível atualizar o perfil");
  }
  const patch = {
    ...(data.roleId !== undefined ? { role_id: data.roleId } : {}),
    ...(data.departmentId !== undefined ? { department_id: data.departmentId } : {}),
    ...(data.managerId !== undefined ? { manager_id: data.managerId } : {}),
    ...(data.fullName !== undefined ? { full_name: data.fullName } : {}),
  };
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin.from("employees").update(patch).eq("id", employeeId).eq("org_id", emp.org_id);
    if (error) throw new Error("Não foi possível atualizar o colaborador");
  }
  return { ok: true };
}

export async function deleteEmployee(employeeId: string, actor: EmployeeActor) {
  const emp = await requireEmployeeAccess(actor, employeeId);
  // Removing an employment record must never delete a global Auth identity.
  const { error } = await supabaseAdmin.from("employees").delete().eq("id", employeeId).eq("org_id", emp.org_id);
  if (error) throw new Error("Não foi possível excluir o colaborador");
  return { ok: true };
}
