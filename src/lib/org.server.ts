import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Returns the org_id for a user. If multiple, returns the first by created_at.
 * Throws if the user is not a member of any org.
 */
export async function getUserOrgId(userId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Usuário não pertence a nenhuma empresa");
  return data.org_id;
}
