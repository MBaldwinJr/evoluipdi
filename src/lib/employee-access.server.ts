import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireOrgAccess, type AuthenticatedClient } from "./security-access";

export interface EmployeeActor {
  readonly client: AuthenticatedClient;
  readonly userId: string;
}

export async function requireEmployeeAccess(actor: EmployeeActor, employeeId: string) {
  // Read through RLS first; never use a global RH role as tenant authorization.
  const { data, error } = await actor.client.from("employees").select("id, org_id, user_id").eq("id", employeeId).maybeSingle();
  if (error || !data) throw new Error("Colaborador não encontrado ou acesso negado");
  await requireOrgAccess(actor.client, actor.userId, data.org_id, ["admin", "rh"]);
  return data;
}

export async function requireEmployeeReferences(orgId: string, data: { roleId?: string | null; departmentId?: string | null; managerId?: string | null }) {
  if (data.roleId) {
    const { data: row, error } = await supabaseAdmin.from("roles_catalog").select("id").eq("id", data.roleId).eq("org_id", orgId).maybeSingle();
    if (error || !row) throw new Error("Cargo não pertence à empresa");
  }
  if (data.departmentId) {
    const { data: row, error } = await supabaseAdmin.from("departments").select("id").eq("id", data.departmentId).eq("org_id", orgId).maybeSingle();
    if (error || !row) throw new Error("Setor não pertence à empresa");
  }
  if (data.managerId) {
    const { data: row, error } = await supabaseAdmin.from("employees").select("id").eq("id", data.managerId).eq("org_id", orgId).maybeSingle();
    if (error || !row) throw new Error("Gestor não pertence à empresa");
  }
}