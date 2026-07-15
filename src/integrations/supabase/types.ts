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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_turns: {
        Row: {
          created_at: string
          id: string
          interview_id: string
          model_output: Json | null
          prompt: string
          tts_audio_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interview_id: string
          model_output?: Json | null
          prompt: string
          tts_audio_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interview_id?: string
          model_output?: Json | null
          prompt?: string
          tts_audio_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_turns_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          id: string
          org_id: string
          phone: string | null
          resume_text: string | null
          resume_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          id?: string
          org_id: string
          phone?: string | null
          resume_text?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          id?: string
          org_id?: string
          phone?: string | null
          resume_text?: string | null
          resume_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_invitations: {
        Row: {
          id: string
          mock_session_id: string
          recipient_email: string
          sent_by: string
          resend_message_id: string | null
          status: string
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          mock_session_id: string
          recipient_email: string
          sent_by: string
          resend_message_id?: string | null
          status?: string
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          mock_session_id?: string
          recipient_email?: string
          sent_by?: string
          resend_message_id?: string | null
          status?: string
          sent_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_invitations_mock_session_id_fkey"
            columns: ["mock_session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_tags: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          experience_level: string | null
          full_name: string | null
          id: string
          org_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          experience_level?: string | null
          full_name?: string | null
          id?: string
          org_id: string
          tag: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          experience_level?: string | null
          full_name?: string | null
          id?: string
          org_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_tags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      job_applications: {
        Row: {
          applicant_id: string
          created_at: string
          email: string
          full_name: string
          id: string
          job_id: string
          match_reasoning: string | null
          match_score: number | null
          phone: string | null
          resume_text: string | null
          resume_url: string
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          email: string
          full_name: string
          id?: string
          job_id: string
          match_reasoning?: string | null
          match_score?: number | null
          phone?: string | null
          resume_text?: string | null
          resume_url: string
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          job_id?: string
          match_reasoning?: string | null
          match_score?: number | null
          phone?: string | null
          resume_text?: string | null
          resume_url?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          }
        ]
      }
      jobs: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description_html: string
          employment_type: string | null
          expires_at: string | null
          id: string
          location: string | null
          org_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          description_html?: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          org_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description_html?: string
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          location?: string | null
          org_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          }
        ]
      }
      interviews: {
        Row: {
          candidate_id: string
          created_at: string
          ended_at: string | null
          id: string
          interviewer_id: string | null
          invite_token: string | null
          mock_session_id: string | null
          org_id: string
          question_pack_id: string | null
          questions: Json | null
          room_id: string | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          interviewer_id?: string | null
          invite_token?: string | null
          mock_session_id?: string | null
          org_id: string
          question_pack_id?: string | null
          room_id?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          interviewer_id?: string | null
          invite_token?: string | null
          mock_session_id?: string | null
          org_id?: string
          question_pack_id?: string | null
          room_id?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interviews_question_pack_id_fkey"
            columns: ["question_pack_id"]
            isOneToOne: false
            referencedRelation: "question_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      question_packs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          org_id: string
          questions: Json
          role_target: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id: string
          questions?: Json
          role_target?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          org_id?: string
          questions?: Json
          role_target?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_packs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scores: {
        Row: {
          created_at: string
          dimension: string
          evidence: string | null
          id: string
          interview_id: string
          score: number
        }
        Insert: {
          created_at?: string
          dimension: string
          evidence?: string | null
          id?: string
          interview_id: string
          score: number
        }
        Update: {
          created_at?: string
          dimension?: string
          evidence?: string | null
          id?: string
          interview_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "scores_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      transcript_events: {
        Row: {
          created_at: string
          id: string
          interview_id: string
          is_final: boolean
          sequence: number
          speaker: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          interview_id: string
          is_final?: boolean
          sequence?: number
          speaker: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          interview_id?: string
          is_final?: boolean
          sequence?: number
          speaker?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_events_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      mock_sessions: {
        Row: {
          id: string
          user_id: string
          org_id: string | null
          resume_url: string | null
          resume_text: string | null
          job_description: string
          job_title: string | null
          questions: Json
          scheduled_at: string | null
          status: string
          interview_id: string | null
          created_by: string | null
          invite_token: string | null
          invite_email_sent: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id?: string | null
          resume_url?: string | null
          resume_text?: string | null
          job_description: string
          job_title?: string | null
          questions?: Json
          scheduled_at?: string | null
          status?: string
          interview_id?: string | null
          created_by?: string | null
          invite_token?: string | null
          invite_email_sent?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string | null
          resume_url?: string | null
          resume_text?: string | null
          job_description?: string
          job_title?: string | null
          questions?: Json
          scheduled_at?: string | null
          status?: string
          interview_id?: string | null
          created_by?: string | null
          invite_token?: string | null
          invite_email_sent?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_sessions_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "interviewer" | "candidate" | "user"
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
      app_role: ["admin", "interviewer", "candidate", "user"],
    },
  },
} as const
