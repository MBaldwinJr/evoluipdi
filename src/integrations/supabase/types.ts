export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_events: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          org_id: string
          payload: Json
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          org_id: string
          payload?: Json
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          ai_fit_score: number | null
          ai_fit_summary: string | null
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          notes: string | null
          org_id: string
          rating: number | null
          rejection_reason: string | null
          stage: Database["public"]["Enums"]["application_stage"]
          stage_order: number
          talent_id: string
          updated_at: string
        }
        Insert: {
          ai_fit_score?: number | null
          ai_fit_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          notes?: string | null
          org_id: string
          rating?: number | null
          rejection_reason?: string | null
          stage?: Database["public"]["Enums"]["application_stage"]
          stage_order?: number
          talent_id: string
          updated_at?: string
        }
        Update: {
          ai_fit_score?: number | null
          ai_fit_summary?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          org_id?: string
          rating?: number | null
          rejection_reason?: string | null
          stage?: Database["public"]["Enums"]["application_stage"]
          stage_order?: number
          talent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_talent_id_fkey"
            columns: ["talent_id"]
            isOneToOne: false
            referencedRelation: "talent_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_interviews: {
        Row: {
          application_id: string
          created_at: string
          created_by: string | null
          duration_min: number
          id: string
          interviewer_name: string | null
          interviewer_user_id: string | null
          location: string | null
          meeting_url: string | null
          mode: Database["public"]["Enums"]["candidate_interview_mode"]
          notes: string | null
          org_id: string
          reminder_sent_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["candidate_interview_status"]
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          created_by?: string | null
          duration_min?: number
          id?: string
          interviewer_name?: string | null
          interviewer_user_id?: string | null
          location?: string | null
          meeting_url?: string | null
          mode?: Database["public"]["Enums"]["candidate_interview_mode"]
          notes?: string | null
          org_id: string
          reminder_sent_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["candidate_interview_status"]
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          created_by?: string | null
          duration_min?: number
          id?: string
          interviewer_name?: string | null
          interviewer_user_id?: string | null
          location?: string | null
          meeting_url?: string | null
          mode?: Database["public"]["Enums"]["candidate_interview_mode"]
          notes?: string | null
          org_id?: string
          reminder_sent_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["candidate_interview_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_interviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_invites: {
        Row: {
          analysis: Json | null
          analyzed_at: string | null
          answers: Json | null
          candidate_email: string | null
          candidate_name: string
          candidate_phone: string | null
          created_at: string
          created_by: string
          cv_analysis: Json | null
          cv_analyzed_at: string | null
          cv_filename: string | null
          cv_path: string | null
          cv_uploaded_at: string | null
          expires_at: string | null
          hire_status: string
          hired_at: string | null
          hired_employee_id: string | null
          id: string
          notes: string | null
          org_id: string
          presential_at: string | null
          presential_done: boolean
          presential_notes: string | null
          role_id: string
          status: string
          submitted_at: string | null
          template_id: string | null
          token: string
          updated_at: string
        }
        Insert: {
          analysis?: Json | null
          analyzed_at?: string | null
          answers?: Json | null
          candidate_email?: string | null
          candidate_name: string
          candidate_phone?: string | null
          created_at?: string
          created_by: string
          cv_analysis?: Json | null
          cv_analyzed_at?: string | null
          cv_filename?: string | null
          cv_path?: string | null
          cv_uploaded_at?: string | null
          expires_at?: string | null
          hire_status?: string
          hired_at?: string | null
          hired_employee_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          presential_at?: string | null
          presential_done?: boolean
          presential_notes?: string | null
          role_id: string
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          token?: string
          updated_at?: string
        }
        Update: {
          analysis?: Json | null
          analyzed_at?: string | null
          answers?: Json | null
          candidate_email?: string | null
          candidate_name?: string
          candidate_phone?: string | null
          created_at?: string
          created_by?: string
          cv_analysis?: Json | null
          cv_analyzed_at?: string | null
          cv_filename?: string | null
          cv_path?: string | null
          cv_uploaded_at?: string | null
          expires_at?: string | null
          hire_status?: string
          hired_at?: string | null
          hired_employee_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          presential_at?: string | null
          presential_done?: boolean
          presential_notes?: string | null
          role_id?: string
          status?: string
          submitted_at?: string | null
          template_id?: string | null
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_invites_hired_employee_id_fkey"
            columns: ["hired_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_invites_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_invites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "interview_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          org_id: string
          pdi_id: string | null
          scheduled_for: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          org_id?: string
          pdi_id?: string | null
          scheduled_for: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          org_id?: string
          pdi_id?: string | null
          scheduled_for?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkins_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "pdis"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string | null
          created_at: string
          id: string
          legal_name: string | null
          notes: string | null
          segment: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          notes?: string | null
          segment?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          legal_name?: string | null
          notes?: string | null
          segment?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          branch_id: string | null
          career_goals: string | null
          contract_type: string | null
          cpf: string | null
          created_at: string
          department_id: string | null
          full_name: string | null
          hire_date: string | null
          id: string
          legacy_pt_employee_id: string | null
          manager_id: string | null
          org_id: string
          registration: string | null
          role_id: string | null
          schedule_id: string | null
          updated_at: string
          user_id: string | null
          weekly_hours: number | null
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          career_goals?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          legacy_pt_employee_id?: string | null
          manager_id?: string | null
          org_id?: string
          registration?: string | null
          role_id?: string | null
          schedule_id?: string | null
          updated_at?: string
          user_id?: string | null
          weekly_hours?: number | null
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          career_goals?: string | null
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          department_id?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          legacy_pt_employee_id?: string | null
          manager_id?: string | null
          org_id?: string
          registration?: string | null
          role_id?: string | null
          schedule_id?: string | null
          updated_at?: string
          user_id?: string | null
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_scores: {
        Row: {
          created_at: string
          evaluation_id: string
          expected_level: number
          id: string
          level: Database["public"]["Enums"]["performance_level"]
          observed_level: number
          rcf_item_id: string
        }
        Insert: {
          created_at?: string
          evaluation_id: string
          expected_level: number
          id?: string
          level: Database["public"]["Enums"]["performance_level"]
          observed_level: number
          rcf_item_id: string
        }
        Update: {
          created_at?: string
          evaluation_id?: string
          expected_level?: number
          id?: string
          level?: Database["public"]["Enums"]["performance_level"]
          observed_level?: number
          rcf_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_scores_rcf_item_id_fkey"
            columns: ["rcf_item_id"]
            isOneToOne: false
            referencedRelation: "rcf_items"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          cycle_label: string | null
          employee_id: string
          evaluator_id: string
          fact: string
          id: string
          impact: string
          next_step: string
          occurred_at: string
          org_id: string
          overall_level: Database["public"]["Enums"]["performance_level"]
        }
        Insert: {
          created_at?: string
          cycle_label?: string | null
          employee_id: string
          evaluator_id: string
          fact: string
          id?: string
          impact: string
          next_step: string
          occurred_at?: string
          org_id?: string
          overall_level: Database["public"]["Enums"]["performance_level"]
        }
        Update: {
          created_at?: string
          cycle_label?: string | null
          employee_id?: string
          evaluator_id?: string
          fact?: string
          id?: string
          impact?: string
          next_step?: string
          occurred_at?: string
          org_id?: string
          overall_level?: Database["public"]["Enums"]["performance_level"]
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          author_id: string
          created_at: string
          employee_id: string
          fact: string
          id: string
          impact: string | null
          kind: Database["public"]["Enums"]["feedback_kind"]
          next_step: string | null
          occurred_at: string
          org_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          employee_id: string
          fact: string
          id?: string
          impact?: string | null
          kind?: Database["public"]["Enums"]["feedback_kind"]
          next_step?: string | null
          occurred_at?: string
          org_id?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          employee_id?: string
          fact?: string
          id?: string
          impact?: string | null
          kind?: Database["public"]["Enums"]["feedback_kind"]
          next_step?: string | null
          occurred_at?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      gaps: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          justification: string | null
          org_id: string
          rcf_item_id: string | null
          resolved: boolean
          root_cause: string | null
          severity: Database["public"]["Enums"]["gap_severity"]
          source: string | null
          title: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          justification?: string | null
          org_id?: string
          rcf_item_id?: string | null
          resolved?: boolean
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["gap_severity"]
          source?: string | null
          title: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          justification?: string | null
          org_id?: string
          rcf_item_id?: string | null
          resolved?: boolean
          root_cause?: string | null
          severity?: Database["public"]["Enums"]["gap_severity"]
          source?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "gaps_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gaps_rcf_item_id_fkey"
            columns: ["rcf_item_id"]
            isOneToOne: false
            referencedRelation: "rcf_items"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_answers: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          interview_id: string
          observed_level: number | null
          question: string
          rcf_item_id: string | null
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          interview_id: string
          observed_level?: number | null
          question: string
          rcf_item_id?: string | null
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          interview_id?: string
          observed_level?: number | null
          question?: string
          rcf_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_answers_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interview_answers_rcf_item_id_fkey"
            columns: ["rcf_item_id"]
            isOneToOne: false
            referencedRelation: "rcf_items"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_templates: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["interview_kind"]
          org_id: string
          questions: Json
          role_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["interview_kind"]
          org_id?: string
          questions?: Json
          role_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["interview_kind"]
          org_id?: string
          questions?: Json
          role_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_templates_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          analysis: Json | null
          analyzed_at: string | null
          conducted_by: string
          created_at: string
          employee_id: string
          id: string
          kind: Database["public"]["Enums"]["interview_kind"]
          notes: string | null
          occurred_at: string
          org_id: string
          overall_level: Database["public"]["Enums"]["performance_level"] | null
          template_id: string | null
        }
        Insert: {
          analysis?: Json | null
          analyzed_at?: string | null
          conducted_by: string
          created_at?: string
          employee_id: string
          id?: string
          kind: Database["public"]["Enums"]["interview_kind"]
          notes?: string | null
          occurred_at?: string
          org_id?: string
          overall_level?:
            | Database["public"]["Enums"]["performance_level"]
            | null
          template_id?: string | null
        }
        Update: {
          analysis?: Json | null
          analyzed_at?: string | null
          conducted_by?: string
          created_at?: string
          employee_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["interview_kind"]
          notes?: string | null
          occurred_at?: string
          org_id?: string
          overall_level?:
            | Database["public"]["Enums"]["performance_level"]
            | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "interview_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      job_templates: {
        Row: {
          created_at: string
          department_id: string | null
          description_template: string | null
          id: string
          name: string
          org_id: string
          requirements_template: string | null
          responsibilities_template: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          description_template?: string | null
          id?: string
          name: string
          org_id: string
          requirements_template?: string | null
          responsibilities_template?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          description_template?: string | null
          id?: string
          name?: string
          org_id?: string
          requirements_template?: string | null
          responsibilities_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_templates_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          benefits: Json
          closing_date: string | null
          code: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          employment_type: Database["public"]["Enums"]["employment_type"]
          id: string
          location: string | null
          org_id: string
          requirements: string | null
          responsibilities: string | null
          role_id: string | null
          salary_max: number | null
          salary_min: number | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          vacancies_quantity: number
          work_model: Database["public"]["Enums"]["work_model"]
        }
        Insert: {
          benefits?: Json
          closing_date?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          location?: string | null
          org_id: string
          requirements?: string | null
          responsibilities?: string | null
          role_id?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          vacancies_quantity?: number
          work_model?: Database["public"]["Enums"]["work_model"]
        }
        Update: {
          benefits?: Json
          closing_date?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          employment_type?: Database["public"]["Enums"]["employment_type"]
          id?: string
          location?: string | null
          org_id?: string
          requirements?: string | null
          responsibilities?: string | null
          role_id?: string | null
          salary_max?: number | null
          salary_min?: number | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          vacancies_quantity?: number
          work_model?: Database["public"]["Enums"]["work_model"]
        }
        Relationships: [
          {
            foreignKeyName: "jobs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string | null
          name: string
          phone: string | null
          source: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          source?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          source?: string | null
        }
        Relationships: []
      }
      learning_logs: {
        Row: {
          content: string | null
          created_at: string
          employee_id: string
          id: string
          org_id: string
          pdi_action_id: string | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          employee_id: string
          id?: string
          org_id?: string
          pdi_action_id?: string | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          org_id?: string
          pdi_action_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_logs_pdi_action_id_fkey"
            columns: ["pdi_action_id"]
            isOneToOne: false
            referencedRelation: "pdi_actions"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_tasks: {
        Row: {
          application_id: string | null
          category: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          employee_id: string
          id: string
          order_index: number
          org_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          category: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          employee_id: string
          id?: string
          order_index?: number
          org_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          employee_id?: string
          id?: string
          order_index?: number
          org_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_tasks_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      org_email_outbox: {
        Row: {
          created_at: string
          error: string | null
          id: string
          org_id: string
          sender: string
          status: string
          subject: string
          template_key: string | null
          to_email: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          org_id: string
          sender: string
          status: string
          subject: string
          template_key?: string | null
          to_email: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          org_id?: string
          sender?: string
          status?: string
          subject?: string
          template_key?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_email_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_email_settings: {
        Row: {
          created_at: string
          from_email: string
          from_name: string
          host: string
          is_active: boolean
          last_test_at: string | null
          last_test_error: string | null
          last_test_ok: boolean | null
          org_id: string
          password: string
          port: number
          reply_to: string | null
          secure: boolean
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          from_email: string
          from_name: string
          host: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          org_id: string
          password: string
          port?: number
          reply_to?: string | null
          secure?: boolean
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          from_email?: string
          from_name?: string
          host?: string
          is_active?: boolean
          last_test_at?: string | null
          last_test_error?: string | null
          last_test_ok?: boolean | null
          org_id?: string
          password?: string
          port?: number
          reply_to?: string | null
          secure?: boolean
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_email_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          created_at: string
          id: string
          is_active: boolean
          org_id: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          org_id: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          org_id?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_email_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_plans: {
        Row: {
          active: boolean
          created_at: string
          id: string
          limits: Json
          modules: string[]
          org_id: string
          plan_code: Database["public"]["Enums"]["plan_code"]
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          limits?: Json
          modules?: string[]
          org_id: string
          plan_code?: Database["public"]["Enums"]["plan_code"]
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          limits?: Json
          modules?: string[]
          org_id?: string
          plan_code?: Database["public"]["Enums"]["plan_code"]
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          interval: string | null
          org_id: string
          plan_code: Database["public"]["Enums"]["plan_code"]
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          interval?: string | null
          org_id: string
          plan_code?: Database["public"]["Enums"]["plan_code"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          interval?: string | null
          org_id?: string
          plan_code?: Database["public"]["Enums"]["plan_code"]
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orgs: {
        Row: {
          block_outside_geofence: boolean
          cnae_code: string | null
          cnae_description: string | null
          cnpj: string | null
          created_at: string
          created_by: string
          id: string
          legal_name: string
          receita_payload: Json | null
          receita_validated_at: string | null
          segment: string | null
          status: Database["public"]["Enums"]["org_status"]
          timezone: string
          trade_name: string | null
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          block_outside_geofence?: boolean
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          created_at?: string
          created_by: string
          id?: string
          legal_name: string
          receita_payload?: Json | null
          receita_validated_at?: string | null
          segment?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          timezone?: string
          trade_name?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          block_outside_geofence?: boolean
          cnae_code?: string | null
          cnae_description?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string
          id?: string
          legal_name?: string
          receita_payload?: Json | null
          receita_validated_at?: string | null
          segment?: string | null
          status?: Database["public"]["Enums"]["org_status"]
          timezone?: string
          trade_name?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdi_actions: {
        Row: {
          category: Database["public"]["Enums"]["action_category"]
          completed_at: string | null
          created_at: string
          description: string
          development_point_id: string
          due_date: string | null
          id: string
          status: Database["public"]["Enums"]["action_status"]
        }
        Insert: {
          category: Database["public"]["Enums"]["action_category"]
          completed_at?: string | null
          created_at?: string
          description: string
          development_point_id: string
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["action_status"]
        }
        Update: {
          category?: Database["public"]["Enums"]["action_category"]
          completed_at?: string | null
          created_at?: string
          description?: string
          development_point_id?: string
          due_date?: string | null
          id?: string
          status?: Database["public"]["Enums"]["action_status"]
        }
        Relationships: [
          {
            foreignKeyName: "pdi_actions_development_point_id_fkey"
            columns: ["development_point_id"]
            isOneToOne: false
            referencedRelation: "pdi_development_points"
            referencedColumns: ["id"]
          },
        ]
      }
      pdi_development_points: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          gap_id: string | null
          id: string
          pdi_id: string
          success_criteria: string | null
        }
        Insert: {
          created_at?: string
          description: string
          due_date?: string | null
          gap_id?: string | null
          id?: string
          pdi_id: string
          success_criteria?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          gap_id?: string | null
          id?: string
          pdi_id?: string
          success_criteria?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdi_development_points_gap_id_fkey"
            columns: ["gap_id"]
            isOneToOne: false
            referencedRelation: "gaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdi_development_points_pdi_id_fkey"
            columns: ["pdi_id"]
            isOneToOne: false
            referencedRelation: "pdis"
            referencedColumns: ["id"]
          },
        ]
      }
      pdis: {
        Row: {
          created_at: string
          due_date: string | null
          employee_id: string
          horizon: Database["public"]["Enums"]["objective_horizon"]
          id: string
          objective: string
          org_id: string
          status: Database["public"]["Enums"]["pdi_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          employee_id: string
          horizon?: Database["public"]["Enums"]["objective_horizon"]
          id?: string
          objective: string
          org_id?: string
          status?: Database["public"]["Enums"]["pdi_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          due_date?: string | null
          employee_id?: string
          horizon?: Database["public"]["Enums"]["objective_horizon"]
          id?: string
          objective?: string
          org_id?: string
          status?: Database["public"]["Enums"]["pdi_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdis_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      position_kpis: {
        Row: {
          benefits: Json
          created_at: string
          driver_license: string | null
          education_required: string | null
          experience_years: number | null
          id: string
          mandatory_certifications: Json
          mandatory_courses: Json
          org_id: string
          required_skills: Json
          role_id: string
          salary_reference: number | null
          soft_skills: Json
          travel_required: boolean
          updated_at: string
          work_location: string | null
          work_schedule: string | null
        }
        Insert: {
          benefits?: Json
          created_at?: string
          driver_license?: string | null
          education_required?: string | null
          experience_years?: number | null
          id?: string
          mandatory_certifications?: Json
          mandatory_courses?: Json
          org_id: string
          required_skills?: Json
          role_id: string
          salary_reference?: number | null
          soft_skills?: Json
          travel_required?: boolean
          updated_at?: string
          work_location?: string | null
          work_schedule?: string | null
        }
        Update: {
          benefits?: Json
          created_at?: string
          driver_license?: string | null
          education_required?: string | null
          experience_years?: number | null
          id?: string
          mandatory_certifications?: Json
          mandatory_courses?: Json
          org_id?: string
          required_skills?: Json
          role_id?: string
          salary_reference?: number | null
          soft_skills?: Json
          travel_required?: boolean
          updated_at?: string
          work_location?: string | null
          work_schedule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "position_kpis_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_kpis_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pt_anomalies: {
        Row: {
          company_id: string
          created_at: string
          details: Json | null
          employee_id: string | null
          id: string
          kind: string
          punch_id: string | null
          resolved: boolean
          severity: string
        }
        Insert: {
          company_id: string
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          id?: string
          kind: string
          punch_id?: string | null
          resolved?: boolean
          severity?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          details?: Json | null
          employee_id?: string | null
          id?: string
          kind?: string
          punch_id?: string | null
          resolved?: boolean
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_anomalies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_anomalies_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "pt_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_anomalies_punch_id_fkey"
            columns: ["punch_id"]
            isOneToOne: false
            referencedRelation: "pt_punches"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          company_id: string
          id: string
          ip: string | null
          target_id: string | null
          target_table: string | null
          ts: string
          ua: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_table?: string | null
          ts?: string
          ua?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_table?: string | null
          ts?: string
          ua?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pt_audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_branches: {
        Row: {
          active: boolean
          address: string | null
          company_id: string
          created_at: string
          geofence_radius_m: number
          id: string
          lat: number | null
          lng: number | null
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          company_id: string
          created_at?: string
          geofence_radius_m?: number
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          company_id?: string
          created_at?: string
          geofence_radius_m?: number
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_companies: {
        Row: {
          block_outside_geofence: boolean
          cnpj: string | null
          created_at: string
          created_by: string
          id: string
          legal_name: string
          timezone: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          block_outside_geofence?: boolean
          cnpj?: string | null
          created_at?: string
          created_by: string
          id?: string
          legal_name: string
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          block_outside_geofence?: boolean
          cnpj?: string | null
          created_at?: string
          created_by?: string
          id?: string
          legal_name?: string
          timezone?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pt_company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["pt_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["pt_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["pt_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_employees: {
        Row: {
          active: boolean
          branch_id: string | null
          company_id: string
          contract_type: string | null
          cpf: string | null
          created_at: string
          full_name: string
          hire_date: string | null
          id: string
          manager_id: string | null
          registration: string | null
          role_title: string | null
          schedule_id: string | null
          updated_at: string
          user_id: string | null
          weekly_hours: number | null
        }
        Insert: {
          active?: boolean
          branch_id?: string | null
          company_id: string
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          full_name: string
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          registration?: string | null
          role_title?: string | null
          schedule_id?: string | null
          updated_at?: string
          user_id?: string | null
          weekly_hours?: number | null
        }
        Update: {
          active?: boolean
          branch_id?: string | null
          company_id?: string
          contract_type?: string | null
          cpf?: string | null
          created_at?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          registration?: string | null
          role_title?: string | null
          schedule_id?: string | null
          updated_at?: string
          user_id?: string | null
          weekly_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pt_employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "pt_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "pt_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_employees_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "pt_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_holidays: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          date: string
          id: string
          name: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          date: string
          id?: string
          name: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_holidays_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "pt_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_holidays_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_punches: {
        Row: {
          accuracy_m: number | null
          anomaly_flags: string[] | null
          branch_id: string | null
          company_id: string
          created_at: string
          device_info: Json | null
          distance_to_branch_m: number | null
          employee_id: string
          id: string
          inside_geofence: boolean | null
          ip: string | null
          kind: Database["public"]["Enums"]["pt_punch_kind"]
          lat: number | null
          lng: number | null
          notes: string | null
          selfie_path: string | null
          source: Database["public"]["Enums"]["pt_punch_source"]
          status: Database["public"]["Enums"]["pt_punch_status"]
          ts: string
        }
        Insert: {
          accuracy_m?: number | null
          anomaly_flags?: string[] | null
          branch_id?: string | null
          company_id: string
          created_at?: string
          device_info?: Json | null
          distance_to_branch_m?: number | null
          employee_id: string
          id?: string
          inside_geofence?: boolean | null
          ip?: string | null
          kind: Database["public"]["Enums"]["pt_punch_kind"]
          lat?: number | null
          lng?: number | null
          notes?: string | null
          selfie_path?: string | null
          source?: Database["public"]["Enums"]["pt_punch_source"]
          status?: Database["public"]["Enums"]["pt_punch_status"]
          ts?: string
        }
        Update: {
          accuracy_m?: number | null
          anomaly_flags?: string[] | null
          branch_id?: string | null
          company_id?: string
          created_at?: string
          device_info?: Json | null
          distance_to_branch_m?: number | null
          employee_id?: string
          id?: string
          inside_geofence?: boolean | null
          ip?: string | null
          kind?: Database["public"]["Enums"]["pt_punch_kind"]
          lat?: number | null
          lng?: number | null
          notes?: string | null
          selfie_path?: string | null
          source?: Database["public"]["Enums"]["pt_punch_source"]
          status?: Database["public"]["Enums"]["pt_punch_status"]
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "pt_punches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "pt_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_punches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pt_punches_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "pt_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      pt_schedules: {
        Row: {
          company_id: string
          created_at: string
          id: string
          interjornada_min: number
          intrajornada_min: number
          kind: Database["public"]["Enums"]["pt_schedule_kind"]
          name: string
          night_shift_end: string | null
          night_shift_start: string | null
          tolerance_min: number
          updated_at: string
          weekly_pattern: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          interjornada_min?: number
          intrajornada_min?: number
          kind?: Database["public"]["Enums"]["pt_schedule_kind"]
          name: string
          night_shift_end?: string | null
          night_shift_start?: string | null
          tolerance_min?: number
          updated_at?: string
          weekly_pattern?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          interjornada_min?: number
          intrajornada_min?: number
          kind?: Database["public"]["Enums"]["pt_schedule_kind"]
          name?: string
          night_shift_end?: string | null
          night_shift_start?: string | null
          tolerance_min?: number
          updated_at?: string
          weekly_pattern?: Json
        }
        Relationships: [
          {
            foreignKeyName: "pt_schedules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "pt_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_action_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          how: string | null
          how_much_cents: number
          id: string
          occurrence_id: string | null
          org_id: string
          status: Database["public"]["Enums"]["quality_action_status"]
          updated_at: string
          what: string
          when_due: string | null
          where_at: string | null
          who: string | null
          why: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          how?: string | null
          how_much_cents?: number
          id?: string
          occurrence_id?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["quality_action_status"]
          updated_at?: string
          what: string
          when_due?: string | null
          where_at?: string | null
          who?: string | null
          why?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          how?: string | null
          how_much_cents?: number
          id?: string
          occurrence_id?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["quality_action_status"]
          updated_at?: string
          what?: string
          when_due?: string | null
          where_at?: string | null
          who?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quality_action_plans_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "quality_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_action_plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audit_log: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          entity: string
          entity_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          org_id: string
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id: string
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audits: {
        Row: {
          created_at: string
          ended_at: string | null
          findings: Json
          id: string
          lead_auditor: string | null
          org_id: string
          scope: string
          score: number | null
          standard: Database["public"]["Enums"]["quality_audit_standard"]
          started_at: string | null
          status: Database["public"]["Enums"]["quality_audit_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          findings?: Json
          id?: string
          lead_auditor?: string | null
          org_id: string
          scope: string
          score?: number | null
          standard: Database["public"]["Enums"]["quality_audit_standard"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["quality_audit_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          findings?: Json
          id?: string
          lead_auditor?: string | null
          org_id?: string
          scope?: string
          score?: number | null
          standard?: Database["public"]["Enums"]["quality_audit_standard"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["quality_audit_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_audits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_capa: {
        Row: {
          capa_type: Database["public"]["Enums"]["quality_capa_type"]
          created_at: string
          description: string
          due_date: string | null
          effectiveness_check: string | null
          id: string
          occurrence_id: string
          org_id: string
          responsible: string | null
          status: Database["public"]["Enums"]["quality_action_status"]
          updated_at: string
        }
        Insert: {
          capa_type: Database["public"]["Enums"]["quality_capa_type"]
          created_at?: string
          description: string
          due_date?: string | null
          effectiveness_check?: string | null
          id?: string
          occurrence_id: string
          org_id: string
          responsible?: string | null
          status?: Database["public"]["Enums"]["quality_action_status"]
          updated_at?: string
        }
        Update: {
          capa_type?: Database["public"]["Enums"]["quality_capa_type"]
          created_at?: string
          description?: string
          due_date?: string | null
          effectiveness_check?: string | null
          id?: string
          occurrence_id?: string
          org_id?: string
          responsible?: string | null
          status?: Database["public"]["Enums"]["quality_action_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_capa_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "quality_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_capa_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_documents: {
        Row: {
          created_at: string
          description: string | null
          file_url: string
          id: string
          occurrence_id: string | null
          org_id: string
          title: string
          uploaded_by: string | null
          version: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_url: string
          id?: string
          occurrence_id?: string | null
          org_id: string
          title: string
          uploaded_by?: string | null
          version?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_url?: string
          id?: string
          occurrence_id?: string | null
          org_id?: string
          title?: string
          uploaded_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_documents_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "quality_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_five_whys: {
        Row: {
          answer: string | null
          created_at: string
          id: string
          occurrence_id: string
          org_id: string
          question: string
          step: number
        }
        Insert: {
          answer?: string | null
          created_at?: string
          id?: string
          occurrence_id: string
          org_id: string
          question: string
          step: number
        }
        Update: {
          answer?: string | null
          created_at?: string
          id?: string
          occurrence_id?: string
          org_id?: string
          question?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_five_whys_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "quality_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_five_whys_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_ishikawa_causes: {
        Row: {
          cause: string
          created_at: string
          dimension: Database["public"]["Enums"]["quality_ishikawa_dim"]
          id: string
          is_root: boolean
          occurrence_id: string
          org_id: string
        }
        Insert: {
          cause: string
          created_at?: string
          dimension: Database["public"]["Enums"]["quality_ishikawa_dim"]
          id?: string
          is_root?: boolean
          occurrence_id: string
          org_id: string
        }
        Update: {
          cause?: string
          created_at?: string
          dimension?: Database["public"]["Enums"]["quality_ishikawa_dim"]
          id?: string
          is_root?: boolean
          occurrence_id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_ishikawa_causes_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "quality_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_ishikawa_causes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_occurrences: {
        Row: {
          assigned_to: string | null
          category: string | null
          closed_at: string | null
          code: string
          created_at: string
          description: string | null
          due_date: string | null
          evidences: Json
          id: string
          org_id: string
          reported_by: string | null
          sector: string | null
          severity: Database["public"]["Enums"]["quality_severity"]
          status: Database["public"]["Enums"]["quality_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          code: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          evidences?: Json
          id?: string
          org_id: string
          reported_by?: string | null
          sector?: string | null
          severity?: Database["public"]["Enums"]["quality_severity"]
          status?: Database["public"]["Enums"]["quality_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string | null
          closed_at?: string | null
          code?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          evidences?: Json
          id?: string
          org_id?: string
          reported_by?: string | null
          sector?: string | null
          severity?: Database["public"]["Enums"]["quality_severity"]
          status?: Database["public"]["Enums"]["quality_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_occurrences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      rcf_items: {
        Row: {
          created_at: string
          description: string | null
          expected_level: number
          id: string
          kind: Database["public"]["Enums"]["rcf_item_kind"]
          org_id: string
          role_id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expected_level?: number
          id?: string
          kind: Database["public"]["Enums"]["rcf_item_kind"]
          org_id?: string
          role_id: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expected_level?: number
          id?: string
          kind?: Database["public"]["Enums"]["rcf_item_kind"]
          org_id?: string
          role_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rcf_items_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      role_processes: {
        Row: {
          created_at: string
          id: string
          objective: string | null
          org_id: string
          role_id: string
          sort_order: number
          steps: Json
          success_criteria: string | null
          title: string
          tools: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          objective?: string | null
          org_id?: string
          role_id: string
          sort_order?: number
          steps?: Json
          success_criteria?: string | null
          title: string
          tools?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          objective?: string | null
          org_id?: string
          role_id?: string
          sort_order?: number
          steps?: Json
          success_criteria?: string | null
          title?: string
          tools?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      roles_catalog: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          org_id: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          org_id?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          org_id?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roles_catalog_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      talent_pool: {
        Row: {
          ai_score: number | null
          ai_summary: string | null
          created_at: string
          created_by: string | null
          current_company: string | null
          current_position: string | null
          cv_text: string | null
          cv_url: string | null
          email: string | null
          full_name: string
          id: string
          linkedin_url: string | null
          location: string | null
          org_id: string
          phone: string | null
          skills: string[]
          source: Database["public"]["Enums"]["talent_source"]
          status: Database["public"]["Enums"]["talent_status"]
          summary: string | null
          tags: string[]
          updated_at: string
          years_experience: number
        }
        Insert: {
          ai_score?: number | null
          ai_summary?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_position?: string | null
          cv_text?: string | null
          cv_url?: string | null
          email?: string | null
          full_name: string
          id?: string
          linkedin_url?: string | null
          location?: string | null
          org_id: string
          phone?: string | null
          skills?: string[]
          source?: Database["public"]["Enums"]["talent_source"]
          status?: Database["public"]["Enums"]["talent_status"]
          summary?: string | null
          tags?: string[]
          updated_at?: string
          years_experience?: number
        }
        Update: {
          ai_score?: number | null
          ai_summary?: string | null
          created_at?: string
          created_by?: string | null
          current_company?: string | null
          current_position?: string | null
          cv_text?: string | null
          cv_url?: string | null
          email?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          location?: string | null
          org_id?: string
          phone?: string | null
          skills?: string[]
          source?: Database["public"]["Enums"]["talent_source"]
          status?: Database["public"]["Enums"]["talent_status"]
          summary?: string | null
          tags?: string[]
          updated_at?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "talent_pool_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_org_id: { Args: never; Returns: string }
      get_employee_basic: {
        Args: { _employee_id: string }
        Returns: {
          career_goals: string
          department_id: string
          department_name: string
          full_name: string
          hire_date: string
          id: string
          manager_id: string
          role_id: string
          role_title: string
          user_id: string
        }[]
      }
      has_org_role: {
        Args: {
          _org: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_of: {
        Args: { _employee_user_id: string; _user_id: string }
        Returns: boolean
      }
      is_manager_of_emp: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_rh: { Args: { _user_id: string }; Returns: boolean }
      is_self_emp: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
      list_team_directory: {
        Args: never
        Returns: {
          department_id: string
          department_name: string
          full_name: string
          hire_date: string
          id: string
          manager_id: string
          role_id: string
          role_title: string
          user_id: string
        }[]
      }
      org_has_module: {
        Args: { _module: string; _org: string }
        Returns: boolean
      }
      org_is_active: { Args: { _org_id: string }; Returns: boolean }
      orgs_for_user: { Args: { _user: string }; Returns: string[] }
      pt_companies_for_user: { Args: { _user: string }; Returns: string[] }
      pt_has_role: {
        Args: {
          _company: string
          _roles: Database["public"]["Enums"]["pt_role"][]
          _user: string
        }
        Returns: boolean
      }
      pt_is_member: {
        Args: { _company: string; _user: string }
        Returns: boolean
      }
      public_apply_to_job: {
        Args: {
          _current_position: string
          _cv_url: string
          _email: string
          _full_name: string
          _job_id: string
          _linkedin_url: string
          _location: string
          _phone: string
          _summary: string
          _years_experience: number
        }
        Returns: string
      }
      public_get_job: {
        Args: { _job_id: string }
        Returns: {
          benefits: Json
          closing_date: string
          company_name: string
          created_at: string
          department_name: string
          description: string
          employment_type: string
          id: string
          location: string
          org_id: string
          requirements: string
          responsibilities: string
          salary_max: number
          salary_min: number
          title: string
          work_model: string
        }[]
      }
      public_list_jobs: {
        Args: {
          _employment_type?: string
          _limit?: number
          _search?: string
          _work_model?: string
        }
        Returns: {
          benefits: Json
          closing_date: string
          company_name: string
          created_at: string
          department_name: string
          employment_type: string
          id: string
          location: string
          org_id: string
          salary_max: number
          salary_min: number
          title: string
          work_model: string
        }[]
      }
      set_employee_manager: {
        Args: { _employee_id: string; _manager_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      action_category: "pratica" | "troca" | "formal"
      action_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      app_role: "colaborador" | "gestor" | "rh" | "super_admin"
      application_stage:
        | "applied"
        | "screening"
        | "interview"
        | "technical"
        | "offer"
        | "hired"
        | "rejected"
      candidate_interview_mode: "online" | "presencial" | "telefone"
      candidate_interview_status:
        | "scheduled"
        | "completed"
        | "cancelled"
        | "no_show"
      employment_type:
        | "clt"
        | "pj"
        | "estagio"
        | "temporario"
        | "aprendiz"
        | "terceirizado"
      feedback_kind: "informal" | "formal"
      gap_severity: "baixa" | "media" | "alta"
      interview_kind:
        | "inicial"
        | "periodica"
        | "avaliacao"
        | "selecao"
        | "feedback"
        | "desligamento"
        | "carreira"
      job_status: "draft" | "open" | "paused" | "closed" | "cancelled"
      objective_horizon: "curto" | "medio" | "longo"
      org_role:
        | "admin"
        | "rh"
        | "gestor"
        | "supervisor"
        | "colaborador"
        | "auditor"
      org_status: "trial" | "active" | "suspended" | "cancelled"
      pdi_status:
        | "rascunho"
        | "aguardando_validacao"
        | "aprovado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      performance_level: "abaixo" | "dentro" | "acima"
      plan_code: "free" | "starter" | "pro" | "enterprise" | "custom"
      pt_punch_kind: "entrada" | "saida" | "inicio_intervalo" | "fim_intervalo"
      pt_punch_source: "web" | "pwa" | "ajuste"
      pt_punch_status: "ok" | "pendente" | "ajustada" | "rejeitada"
      pt_role:
        | "admin"
        | "rh"
        | "gestor"
        | "supervisor"
        | "funcionario"
        | "auditor"
      pt_schedule_kind:
        | "fixa"
        | "cinco_x_dois"
        | "seis_x_um"
        | "doze_x_trinta_seis"
        | "flex"
      quality_action_status:
        | "planejada"
        | "em_andamento"
        | "concluida"
        | "atrasada"
        | "cancelada"
      quality_audit_standard:
        | "iso_9001"
        | "iso_14001"
        | "iso_45001"
        | "interna"
        | "outra"
      quality_audit_status:
        | "planejada"
        | "em_andamento"
        | "concluida"
        | "cancelada"
      quality_capa_type: "corretiva" | "preventiva"
      quality_ishikawa_dim:
        | "homem"
        | "maquina"
        | "metodo"
        | "material"
        | "meio_ambiente"
        | "gestao"
      quality_severity: "baixa" | "media" | "alta" | "critica"
      quality_status:
        | "aberta"
        | "em_analise"
        | "em_acao"
        | "aguardando_aprovacao"
        | "concluida"
        | "cancelada"
      rcf_item_kind:
        | "responsabilidade"
        | "competencia_tecnica"
        | "competencia_comportamental"
        | "indicador"
      talent_source: "manual" | "import" | "application" | "referral"
      talent_status: "active" | "archived" | "hired" | "blacklisted"
      work_model: "presencial" | "hibrido" | "remoto"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_category: ["pratica", "troca", "formal"],
      action_status: ["pendente", "em_andamento", "concluida", "cancelada"],
      app_role: ["colaborador", "gestor", "rh", "super_admin"],
      application_stage: [
        "applied",
        "screening",
        "interview",
        "technical",
        "offer",
        "hired",
        "rejected",
      ],
      candidate_interview_mode: ["online", "presencial", "telefone"],
      candidate_interview_status: [
        "scheduled",
        "completed",
        "cancelled",
        "no_show",
      ],
      employment_type: [
        "clt",
        "pj",
        "estagio",
        "temporario",
        "aprendiz",
        "terceirizado",
      ],
      feedback_kind: ["informal", "formal"],
      gap_severity: ["baixa", "media", "alta"],
      interview_kind: [
        "inicial",
        "periodica",
        "avaliacao",
        "selecao",
        "feedback",
        "desligamento",
        "carreira",
      ],
      job_status: ["draft", "open", "paused", "closed", "cancelled"],
      objective_horizon: ["curto", "medio", "longo"],
      org_role: [
        "admin",
        "rh",
        "gestor",
        "supervisor",
        "colaborador",
        "auditor",
      ],
      org_status: ["trial", "active", "suspended", "cancelled"],
      pdi_status: [
        "rascunho",
        "aguardando_validacao",
        "aprovado",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      performance_level: ["abaixo", "dentro", "acima"],
      plan_code: ["free", "starter", "pro", "enterprise", "custom"],
      pt_punch_kind: ["entrada", "saida", "inicio_intervalo", "fim_intervalo"],
      pt_punch_source: ["web", "pwa", "ajuste"],
      pt_punch_status: ["ok", "pendente", "ajustada", "rejeitada"],
      pt_role: [
        "admin",
        "rh",
        "gestor",
        "supervisor",
        "funcionario",
        "auditor",
      ],
      pt_schedule_kind: [
        "fixa",
        "cinco_x_dois",
        "seis_x_um",
        "doze_x_trinta_seis",
        "flex",
      ],
      quality_action_status: [
        "planejada",
        "em_andamento",
        "concluida",
        "atrasada",
        "cancelada",
      ],
      quality_audit_standard: [
        "iso_9001",
        "iso_14001",
        "iso_45001",
        "interna",
        "outra",
      ],
      quality_audit_status: [
        "planejada",
        "em_andamento",
        "concluida",
        "cancelada",
      ],
      quality_capa_type: ["corretiva", "preventiva"],
      quality_ishikawa_dim: [
        "homem",
        "maquina",
        "metodo",
        "material",
        "meio_ambiente",
        "gestao",
      ],
      quality_severity: ["baixa", "media", "alta", "critica"],
      quality_status: [
        "aberta",
        "em_analise",
        "em_acao",
        "aguardando_aprovacao",
        "concluida",
        "cancelada",
      ],
      rcf_item_kind: [
        "responsabilidade",
        "competencia_tecnica",
        "competencia_comportamental",
        "indicador",
      ],
      talent_source: ["manual", "import", "application", "referral"],
      talent_status: ["active", "archived", "hired", "blacklisted"],
      work_model: ["presencial", "hibrido", "remoto"],
    },
  },
} as const
