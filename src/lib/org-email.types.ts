export interface TalentEmailVars {
  readonly candidate_name?: string;
  readonly job_title?: string;
  readonly stage_label?: string;
  readonly interview_when?: string;
  readonly interview_mode?: string;
  readonly interview_location?: string;
  readonly org_name?: string;
  readonly [key: string]: string | undefined;
}

export interface OrgEmailSettingsView {
  readonly is_configured: boolean;
  readonly is_active: boolean;
  readonly host: string | null;
  readonly port: number | null;
  readonly secure: boolean | null;
  readonly username: string | null;
  readonly from_name: string | null;
  readonly from_email: string | null;
  readonly reply_to: string | null;
  readonly last_test_at: string | null;
  readonly last_test_ok: boolean | null;
  readonly last_test_error: string | null;
}
