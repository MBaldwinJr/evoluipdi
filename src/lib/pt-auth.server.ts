import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PtRole = "admin" | "rh" | "gestor" | "supervisor" | "funcionario" | "auditor";

export async function ptGetMembership(userId: string, companyId: string) {
  const { data, error } = await supabaseAdmin
    .from("pt_company_members")
    .select("role")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.role as PtRole | undefined;
}

export async function ptAssertMember(userId: string, companyId: string) {
  const role = await ptGetMembership(userId, companyId);
  if (!role) throw new Error("Sem acesso a esta empresa");
  return role;
}

export async function ptAssertRole(userId: string, companyId: string, allowed: PtRole[]) {
  const role = await ptAssertMember(userId, companyId);
  if (!allowed.includes(role)) throw new Error(`Permissão insuficiente (necessário: ${allowed.join(", ")})`);
  return role;
}

export async function ptListUserCompanies(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("pt_company_members")
    .select("role, company:pt_companies(id, legal_name, trade_name, timezone, block_outside_geofence)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ role: r.role as PtRole, ...r.company }));
}

export async function ptAuditLog(input: {
  companyId: string;
  actorId: string;
  action: string;
  targetTable?: string;
  targetId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await supabaseAdmin.from("pt_audit_log").insert({
    company_id: input.companyId,
    actor_id: input.actorId,
    action: input.action,
    target_table: input.targetTable,
    target_id: input.targetId,
    before: input.before as any,
    after: input.after as any,
  });
}

// Haversine in meters
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(s));
}
