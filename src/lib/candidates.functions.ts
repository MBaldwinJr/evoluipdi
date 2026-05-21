import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeCandidateInviteById } from "./candidates.server";

export const analyzeCandidateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ inviteId: z.string().uuid(), force: z.boolean().optional() }).parse(i))
  .handler(async ({ data }) => analyzeCandidateInviteById(data.inviteId, !!data.force));
