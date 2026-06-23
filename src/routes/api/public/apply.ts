import { createFileRoute } from "@tanstack/react-router";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);
const MAX_BYTES = 8 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

export const Route = createFileRoute("/api/public/apply")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctype = request.headers.get("content-type") ?? "";
        if (!ctype.includes("multipart/form-data")) {
          return json({ error: "expected_multipart" }, 400);
        }
        const form = await request.formData();
        const jobId = String(form.get("job_id") ?? "").trim();
        const fullName = String(form.get("full_name") ?? "").trim();
        const email = String(form.get("email") ?? "").trim();
        const phone = String(form.get("phone") ?? "").trim();
        const location = String(form.get("location") ?? "").trim();
        const linkedin = String(form.get("linkedin_url") ?? "").trim();
        const position = String(form.get("current_position") ?? "").trim();
        const years = Number(form.get("years_experience") ?? 0) || 0;
        const summary = String(form.get("summary") ?? "").trim();
        const lgpd = String(form.get("lgpd_consent") ?? "") === "true";

        if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "invalid_job" }, 400);
        if (fullName.length < 2) return json({ error: "invalid_name" }, 400);
        if (!lgpd) return json({ error: "lgpd_required" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Verify job is open
        const { data: job } = await supabaseAdmin
          .from("jobs")
          .select("id, org_id, status, closing_date")
          .eq("id", jobId)
          .maybeSingle();
        if (!job || (job as any).status !== "open") return json({ error: "job_unavailable" }, 410);

        // Optional CV upload
        let cvUrl: string | null = null;
        const cv = form.get("cv");
        if (cv && cv instanceof File && cv.size > 0) {
          if (!ALLOWED_MIME.has(cv.type)) return json({ error: "invalid_file_type" }, 415);
          if (cv.size > MAX_BYTES) return json({ error: "file_too_large" }, 413);
          const path = `public/${(job as any).org_id}/${jobId}/${Date.now()}_${sanitizeFilename(cv.name)}`;
          const bytes = new Uint8Array(await cv.arrayBuffer());
          const { error: upErr } = await supabaseAdmin.storage
            .from("candidate-cvs")
            .upload(path, bytes, { contentType: cv.type, upsert: false });
          if (upErr) return json({ error: "upload_failed", details: upErr.message }, 500);
          cvUrl = path;
        }

        const { data: appId, error: rpcErr } = await supabaseAdmin.rpc("public_apply_to_job", {
          _job_id: jobId,
          _full_name: fullName,
          _email: email,
          _phone: phone,
          _location: location,
          _linkedin_url: linkedin,
          _current_position: position,
          _years_experience: years,
          _summary: summary,
          _cv_url: cvUrl ?? "",
        });
        if (rpcErr) return json({ error: "apply_failed", details: rpcErr.message }, 500);

        // Fire-and-forget AI fit score (não bloqueia a resposta ao candidato)
        if (appId) {
          import("@/lib/talent-pool-scoring.server")
            .then(({ scoreApplicationById }) => scoreApplicationById(appId as string))
            .catch(() => undefined);
        }

        return json({ ok: true, application_id: appId });
      },
    },
  },
});
