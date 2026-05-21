import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/candidate/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data: inv } = await supabaseAdmin
          .from("candidate_invites")
          .select("id, candidate_name, candidate_email, status, submitted_at, expires_at, role:roles_catalog(title), template:interview_templates(title, questions)")
          .eq("token", params.token)
          .maybeSingle();
        if (!inv) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        if ((inv as any).expires_at && new Date((inv as any).expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: "expired" }), { status: 410, headers: { "Content-Type": "application/json" } });
        }
        return Response.json({
          candidate_name: (inv as any).candidate_name,
          candidate_email: (inv as any).candidate_email,
          status: (inv as any).status,
          submitted_at: (inv as any).submitted_at,
          role_title: (inv as any).role?.title,
          template_title: (inv as any).template?.title,
          questions: (inv as any).template?.questions ?? [],
        });
      },
      POST: async ({ params, request }) => {
        const body = await request.json().catch(() => null) as any;
        if (!body || !Array.isArray(body.answers)) {
          return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const { data: inv } = await supabaseAdmin
          .from("candidate_invites")
          .select("id, status, expires_at")
          .eq("token", params.token)
          .maybeSingle();
        if (!inv) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
        if ((inv as any).status === "respondido" || (inv as any).status === "analisado") {
          return new Response(JSON.stringify({ error: "already_submitted" }), { status: 409, headers: { "Content-Type": "application/json" } });
        }
        if ((inv as any).expires_at && new Date((inv as any).expires_at) < new Date()) {
          return new Response(JSON.stringify({ error: "expired" }), { status: 410, headers: { "Content-Type": "application/json" } });
        }
        const answers = body.answers
          .filter((a: any) => a && typeof a.question === "string")
          .map((a: any) => ({ question: String(a.question).slice(0, 500), answer: String(a.answer ?? "").slice(0, 5000) }));
        const { error } = await supabaseAdmin
          .from("candidate_invites")
          .update({
            answers,
            notes: body.notes ? String(body.notes).slice(0, 2000) : null,
            submitted_at: new Date().toISOString(),
            status: "respondido",
          })
          .eq("id", (inv as any).id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
        return Response.json({ ok: true });
      },
    },
  },
});
