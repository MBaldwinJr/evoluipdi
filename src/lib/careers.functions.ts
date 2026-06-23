import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type PublicJobListItem = {
  id: string;
  org_id: string;
  company_name: string;
  title: string;
  location: string | null;
  work_model: string;
  employment_type: string;
  salary_min: number | null;
  salary_max: number | null;
  benefits: string[];
  department_name: string | null;
  closing_date: string | null;
  created_at: string;
};

export type PublicJobDetail = PublicJobListItem & {
  requirements: string | null;
  responsibilities: string | null;
  description: string | null;
};

export const listPublicJobs = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        workModel: z.string().optional(),
        employmentType: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data }): Promise<PublicJobListItem[]> => {
    const { data: rows, error } = await publicClient().rpc("public_list_jobs", {
      _search: data.search ?? null,
      _work_model: data.workModel ?? null,
      _employment_type: data.employmentType ?? null,
      _limit: 200,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []) as PublicJobListItem[];
  });

export const getPublicJob = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<PublicJobDetail | null> => {
    const { data: rows, error } = await publicClient().rpc("public_get_job", { _job_id: data.id });
    if (error) throw new Error(error.message);
    const arr = (rows ?? []) as PublicJobDetail[];
    return arr[0] ?? null;
  });
