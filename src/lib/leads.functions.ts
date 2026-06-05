import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LeadSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  phone: z.string().max(40).optional().nullable(),
  company: z.string().max(160).optional().nullable(),
  message: z.string().max(2000).optional().nullable(),
});

export const submitLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LeadSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("leads").insert({
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      company: data.company || null,
      message: data.message || null,
      source: "website",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
