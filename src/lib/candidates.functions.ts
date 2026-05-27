import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { analyzeCandidateInviteById } from "./candidates.server";

async function assertInviteAccess(userId: string, inviteId: string) {
  const { data: rh } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "rh").maybeSingle();
  if (rh) return;
  const { data: inv } = await supabaseAdmin
    .from("candidate_invites")
    .select("created_by")
    .eq("id", inviteId)
    .maybeSingle();
  if (!inv) throw new Error("Convite não encontrado");
  if (inv.created_by === userId) return;
  throw new Error("Acesso negado a este candidato");
}

export const analyzeCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ inviteId: z.string().uuid(), force: z.boolean().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertInviteAccess(context.userId, data.inviteId);
    return analyzeCandidateInviteById(data.inviteId, !!data.force);
  });
