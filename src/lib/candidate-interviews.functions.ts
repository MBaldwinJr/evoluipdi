import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserOrgId } from "./org.server";

export const INTERVIEW_MODES = ["online", "presencial", "telefone"] as const;
export const INTERVIEW_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;

export type InterviewMode = (typeof INTERVIEW_MODES)[number];
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export interface CandidateInterview {
  id: string;
  org_id: string;
  application_id: string;
  scheduled_at: string;
  duration_min: number;
  mode: InterviewMode;
  location: string | null;
  meeting_url: string | null;
  interviewer_user_id: string | null;
  interviewer_name: string | null;
  status: InterviewStatus;
  notes: string | null;
  created_at: string;
}

const scheduleSchema = z.object({
  application_id: z.string().uuid(),
  scheduled_at: z.string().min(1),
  duration_min: z.coerce.number().int().min(5).max(480).default(45),
  mode: z.enum(INTERVIEW_MODES).default("online"),
  location: z.string().optional().nullable(),
  meeting_url: z.string().url().optional().or(z.literal("")).nullable(),
  interviewer_name: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const scheduleInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scheduleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const orgId = await getUserOrgId(userId);
    const { data: row, error } = await supabase
      .from("candidate_interviews")
      .insert({
        org_id: orgId,
        application_id: data.application_id,
        scheduled_at: data.scheduled_at,
        duration_min: data.duration_min,
        mode: data.mode,
        location: data.location || null,
        meeting_url: data.meeting_url || null,
        interviewer_name: data.interviewer_name || null,
        notes: data.notes || null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("application_events").insert({
      org_id: orgId,
      application_id: data.application_id,
      event_type: "interview_scheduled",
      payload: { interview_id: row.id, scheduled_at: data.scheduled_at, mode: data.mode },
      created_by: userId,
    });

    // Fire-and-forget candidate notification
    import("./org-email-dispatch.server")
      .then(async ({ loadApplicationEmailContext, sendOrgEmailEvent, INTERVIEW_MODE_LABEL }) => {
        const ctx = await loadApplicationEmailContext(data.application_id);
        if (!ctx?.to) return;
        const when = new Date(data.scheduled_at).toLocaleString("pt-BR", {
          dateStyle: "long", timeStyle: "short",
        });
        await sendOrgEmailEvent({
          orgId: ctx.orgId, templateKey: "interview_scheduled", to: ctx.to,
          vars: {
            ...ctx.vars,
            interview_when: when,
            interview_mode: INTERVIEW_MODE_LABEL[data.mode] ?? data.mode,
            interview_location: data.meeting_url || data.location || "—",
          },
        });
      })
      .catch(() => undefined);

    return { id: row.id };
  });

export const updateInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(INTERVIEW_STATUSES).optional(),
      scheduled_at: z.string().optional(),
      duration_min: z.coerce.number().int().min(5).max(480).optional(),
      mode: z.enum(INTERVIEW_MODES).optional(),
      location: z.string().nullable().optional(),
      meeting_url: z.string().nullable().optional(),
      interviewer_name: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("candidate_interviews").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("candidate_interviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listInterviewsByApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ application_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("candidate_interviews")
      .select("*")
      .eq("application_id", data.application_id)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CandidateInterview[];
  });

export interface UpcomingInterviewRow extends CandidateInterview {
  candidate_name: string;
  job_title: string;
}

export const listUpcomingInterviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("candidate_interviews")
      .select("*, application:applications!inner(id, talent:talent_pool(full_name), job:jobs(title))")
      .order("scheduled_at", { ascending: true })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const app = (row as { application: { talent: { full_name: string } | null; job: { title: string } | null } }).application;
      return {
        ...(row as CandidateInterview),
        candidate_name: app?.talent?.full_name ?? "—",
        job_title: app?.job?.title ?? "—",
      } as UpcomingInterviewRow;
    });
  });
