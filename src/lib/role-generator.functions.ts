import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateRoleContent } from "./role-generator.server";
import { assertRH } from "./admin.server";

export const generateRoleContentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      roleId: z.string().uuid(),
      title: z.string().min(1).max(200),
      departmentName: z.string().max(200).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    return generateRoleContent(data);
  });
