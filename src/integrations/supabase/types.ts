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
      checkins: {
        Row: {
          completed_at: string | null
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          pdi_id: string | null
          scheduled_for: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          pdi_id?: string | null
          scheduled_for: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
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
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          career_goals: string | null
          created_at: string
          department_id: string | null
          hire_date: string | null
          id: string
          manager_id: string | null
          role_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          career_goals?: string | null
          created_at?: string
          department_id?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          role_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          career_goals?: string | null
          created_at?: string
          department_id?: string | null
          hire_date?: string | null
          id?: string
          manager_id?: string | null
          role_id?: string | null
          updated_at?: string
          user_id?: string
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
          questions: Json
          role_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["interview_kind"]
          questions?: Json
          role_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["interview_kind"]
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
          conducted_by: string
          created_at: string
          employee_id: string
          id: string
          kind: Database["public"]["Enums"]["interview_kind"]
          notes: string | null
          occurred_at: string
          overall_level: Database["public"]["Enums"]["performance_level"] | null
          template_id: string | null
        }
        Insert: {
          conducted_by: string
          created_at?: string
          employee_id: string
          id?: string
          kind: Database["public"]["Enums"]["interview_kind"]
          notes?: string | null
          occurred_at?: string
          overall_level?:
            | Database["public"]["Enums"]["performance_level"]
            | null
          template_id?: string | null
        }
        Update: {
          conducted_by?: string
          created_at?: string
          employee_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["interview_kind"]
          notes?: string | null
          occurred_at?: string
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
      learning_logs: {
        Row: {
          content: string | null
          created_at: string
          employee_id: string
          id: string
          pdi_action_id: string | null
          title: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          employee_id: string
          id?: string
          pdi_action_id?: string | null
          title: string
        }
        Update: {
          content?: string | null
          created_at?: string
          employee_id?: string
          id?: string
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
      rcf_items: {
        Row: {
          created_at: string
          description: string | null
          expected_level: number
          id: string
          kind: Database["public"]["Enums"]["rcf_item_kind"]
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
      roles_catalog: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
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
      is_rh: { Args: { _user_id: string }; Returns: boolean }
      is_self_emp: {
        Args: { _employee_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      action_category: "pratica" | "troca" | "formal"
      action_status: "pendente" | "em_andamento" | "concluida" | "cancelada"
      app_role: "colaborador" | "gestor" | "rh"
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
      objective_horizon: "curto" | "medio" | "longo"
      pdi_status:
        | "rascunho"
        | "aguardando_validacao"
        | "aprovado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
      performance_level: "abaixo" | "dentro" | "acima"
      rcf_item_kind:
        | "responsabilidade"
        | "competencia_tecnica"
        | "competencia_comportamental"
        | "indicador"
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
      app_role: ["colaborador", "gestor", "rh"],
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
      objective_horizon: ["curto", "medio", "longo"],
      pdi_status: [
        "rascunho",
        "aguardando_validacao",
        "aprovado",
        "em_andamento",
        "concluido",
        "cancelado",
      ],
      performance_level: ["abaixo", "dentro", "acima"],
      rcf_item_kind: [
        "responsabilidade",
        "competencia_tecnica",
        "competencia_comportamental",
        "indicador",
      ],
    },
  },
} as const
