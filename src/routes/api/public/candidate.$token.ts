import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_BYTES = 8 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/public/candidate/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data: inv } = await supabaseAdmin
          .from("candidate_invites")
          .select("id, candidate_name, candidate_email, status, submitted_at, expires_at, cv_uploaded_at, cv_filename, role:roles_catalog(title), template:interview_templates(title, questions)")
          .eq("token", params.token)
          .maybeSingle();
        if (!inv) return json({ error: "not_found" }, 404);
        if ((inv as any).expires_at && new Date((inv as any).expires_at) < new Date()) {
          return json({ error: "expired" }, 410);
        }
        return Response.json({
          candidate_name: (inv as any).candidate_name,
          candidate_email: (inv as any).candidate_email,
          status: (inv as any).status,
          submitted_at: (inv as any).submitted_at,
          cv_uploaded_at: (inv as any).cv_uploaded_at,
          cv_filename: (inv as any).cv_filename,
          role_title: (inv as any).role?.title,
          template_title: (inv as any).template?.title,
          questions: (inv as any).template?.questions ?? [],
        });
      },
      POST: async ({ params, request }) => {
        const ctype = request.headers.get("content-type") ?? "";
        const { data: inv } = await supabaseAdmin
          .from("candidate_invites")
          .select("id, status, expires_at")
          .eq("token", params.token)
          .maybeSingle();
        if (!inv) return json({ error: "not_found" }, 404);
        if ((inv as any).expires_at && new Date((inv as any).expires_at) < new Date()) {
          return json({ error: "expired" }, 410);
        }

        // CV upload via multipart
        if (ctype.startsWith("multipart/form-data")) {
          const form = await request.formData();
          const file = form.get("cv");
          if (!(file instanceof File)) return json({ error: "missing_file" }, 400);
          if (file.size > MAX_BYTES) return json({ error: "file_too_large" }, 413);
          if (!ALLOWED_MIME.has(file.type)) return json({ error: "invalid_type" }, 415);
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
          const path = `${(inv as any).id}/${Date.now()}-${safeName}`;
          const bytes = new Uint8Array(await file.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage.from("candidate-cvs").upload(path, bytes, {
            contentType: file.type, upsert: false,
          });
          if (upErr) return json({ error: upErr.message }, 500);
          const { error: updErr } = await supabaseAdmin.from("candidate_invites").update({
            cv_path: path, cv_filename: safeName, cv_uploaded_at: new Date().toISOString(), cv_analysis: null, cv_analyzed_at: null,
          }).eq("id", (inv as any).id);
          if (updErr) return json({ error: updErr.message }, 500);
          return Response.json({ ok: true, filename: safeName });
        }

        // Answers submission via JSON
        const body = await request.json().catch(() => null) as any;
        if (!body || !Array.isArray(body.answers)) return json({ error: "invalid_body" }, 400);
        if ((inv as any).status === "respondido" || (inv as any).status === "analisado") {
          return json({ error: "already_submitted" }, 409);
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
        if (error) return json({ error: error.message }, 500);
        return Response.json({ ok: true });
      },
    },
  },
});
