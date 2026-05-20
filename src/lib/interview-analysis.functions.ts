import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analyzeInterviewById } from "./interview-analysis.server";

export const analyzeInterviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ interviewId: z.string().uuid(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    return analyzeInterviewById(data.interviewId, data.force ?? false);
  });
