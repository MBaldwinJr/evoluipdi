import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AuthenticatedClient = SupabaseClient<Database>;
export type OrgRole = Database["public"]["Enums"]["org_role"];
export const INITIAL_PLAN = "free";
export const ORG_ROLES: readonly OrgRole[] = ["admin", "rh", "gestor", "supervisor", "colaborador", "auditor"];

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isSuperAdmin(client: AuthenticatedClient, userId: string): Promise<boolean> {
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId).eq("role", "super_admin");
  if (error) throw new Error("Não foi possível verificar a autorização");
  return (data?.length ?? 0) > 0;
}

export async function requireSuperAdmin(client: AuthenticatedClient, userId: string): Promise<void> {
  if (!(await isSuperAdmin(client, userId))) throw new Error("Apenas super_admin pode alterar planos");
}

export async function requireOrgAccess(client: AuthenticatedClient, userId: string, orgId: string, roles: readonly OrgRole[] = ORG_ROLES): Promise<void> {
  if (await isSuperAdmin(client, userId)) return;
  const { data, error } = await client.from("org_members").select("role").eq("org_id", orgId).eq("user_id", userId);
  if (error || !data?.some((member) => roles.includes(member.role))) throw new Error("Acesso negado à empresa");
}

export async function requireInvitePermission(client: AuthenticatedClient, userId: string, orgId: string, targetRole?: OrgRole): Promise<void> {
  await requireOrgAccess(client, userId, orgId, targetRole === "admin" ? ["admin"] : ["admin", "rh"]);
}

export function requireInviteIdentity(email: string | undefined, confirmedAt: string | undefined, claims: Record<string, unknown>, inviteEmail?: string): string {
  if (!email || !confirmedAt || ("email_verified" in claims && claims.email_verified !== true)) {
    throw new Error("Confirme seu e-mail para aceitar o convite");
  }
  const normalized = normalizeEmail(email);
  if (!normalized || (typeof claims.email === "string" && normalizeEmail(claims.email) !== normalized) || (inviteEmail !== undefined && normalizeEmail(inviteEmail) !== normalized)) {
    throw new Error("O e-mail autenticado não corresponde ao convite");
  }
  return normalized;
}

export async function requireInterviewAccess(client: AuthenticatedClient, userId: string, interviewId: string): Promise<{ orgId: string }> {
  const { data: interview, error } = await client.from("interviews").select("org_id, employee_id, conducted_by").eq("id", interviewId).maybeSingle();
  if (error || !interview) throw new Error("Entrevista não encontrada ou acesso negado");
  await requireOrgAccess(client, userId, interview.org_id);
  if (await isSuperAdmin(client, userId)) return { orgId: interview.org_id };
  const { data: members, error: memberError } = await client.from("org_members").select("role").eq("org_id", interview.org_id).eq("user_id", userId);
  if (memberError) throw new Error("Não foi possível verificar a autorização");
  if (members?.some((member) => member.role === "admin" || member.role === "rh") || interview.conducted_by === userId) return { orgId: interview.org_id };
  const { data: isManager, error: managerError } = await client.rpc("is_manager_of_emp", { _user_id: userId, _employee_id: interview.employee_id });
  if (managerError || !isManager) throw new Error("Acesso negado a esta entrevista");
  return { orgId: interview.org_id };
}