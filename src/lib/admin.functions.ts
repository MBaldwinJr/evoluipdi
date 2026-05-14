import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRH, createEmployeeUser, replaceEmployeeRole } from "./admin.server";

export const createUserAndEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().min(1).max(200),
    roleId: z.string().uuid().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    return createEmployeeUser(data);
  });

export const setEmployeeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["colaborador","gestor","rh"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRH(context.userId);
    return replaceEmployeeRole(data.userId, data.role);
  });