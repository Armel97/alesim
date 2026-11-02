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
      badges: {
        Row: {
          code: string
          condition_meta: string | null
          condition_type: string
          condition_value: number
          created_at: string
          desc_en: string
          desc_fr: string
          icon: string
          id: string
          title_en: string
          title_fr: string
        }
        Insert: {
          code: string
          condition_meta?: string | null
          condition_type: string
          condition_value: number
          created_at?: string
          desc_en: string
          desc_fr: string
          icon: string
          id?: string
          title_en: string
          title_fr: string
        }
        Update: {
          code?: string
          condition_meta?: string | null
          condition_type?: string
          condition_value?: number
          created_at?: string
          desc_en?: string
          desc_fr?: string
          icon?: string
          id?: string
          title_en?: string
          title_fr?: string
        }
        Relationships: []
      }
      content_library: {
        Row: {
          body_en: string
          body_fr: string
          created_at: string
          duration_min: number
          id: string
          level: string
          slug: string
          tags: string[]
          theme: string
          title_en: string
          title_fr: string
        }
        Insert: {
          body_en: string
          body_fr: string
          created_at?: string
          duration_min?: number
          id?: string
          level: string
          slug: string
          tags?: string[]
          theme: string
          title_en: string
          title_fr: string
        }
        Update: {
          body_en?: string
          body_fr?: string
          created_at?: string
          duration_min?: number
          id?: string
          level?: string
          slug?: string
          tags?: string[]
          theme?: string
          title_en?: string
          title_fr?: string
        }
        Relationships: []
      }
      content_views: {
        Row: {
          content_id: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          content_id: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          content_id?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_views_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_library"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_analyses: {
        Row: {
          axes: Json
          created_at: string
          extracted_text: string
          file_kind: string
          file_name: string
          id: string
          keywords: Json
          lang: string
          score: number
          suggested_lesson_theme: string | null
          summary: string
          target_role: string | null
          tone_note: string
          updated_at: string
          user_id: string
        }
        Insert: {
          axes?: Json
          created_at?: string
          extracted_text: string
          file_kind: string
          file_name: string
          id?: string
          keywords?: Json
          lang?: string
          score?: number
          suggested_lesson_theme?: string | null
          summary?: string
          target_role?: string | null
          tone_note?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          axes?: Json
          created_at?: string
          extracted_text?: string
          file_kind?: string
          file_name?: string
          id?: string
          keywords?: Json
          lang?: string
          score?: number
          suggested_lesson_theme?: string | null
          summary?: string
          target_role?: string | null
          tone_note?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_delivery_events: {
        Row: {
          detail: Json
          event_id: string | null
          event_type: string
          id: string
          message_id: string | null
          occurred_at: string
          recipient: string | null
          status: string | null
          template: string | null
        }
        Insert: {
          detail?: Json
          event_id?: string | null
          event_type: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          recipient?: string | null
          status?: string | null
          template?: string | null
        }
        Update: {
          detail?: Json
          event_id?: string | null
          event_type?: string
          id?: string
          message_id?: string | null
          occurred_at?: string
          recipient?: string | null
          status?: string | null
          template?: string | null
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          anon_id: string
          event: string
          id: string
          lang: string | null
          occurred_at: string
          path: string | null
          props: Json
          session_id: string
          step: string | null
          user_id: string | null
        }
        Insert: {
          anon_id: string
          event: string
          id?: string
          lang?: string | null
          occurred_at?: string
          path?: string | null
          props?: Json
          session_id: string
          step?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string
          event?: string
          id?: string
          lang?: string | null
          occurred_at?: string
          path?: string | null
          props?: Json
          session_id?: string
          step?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      interview_responses: {
        Row: {
          created_at: string
          duration_sec: number
          form_metrics: Json
          id: string
          lang: string
          overall_note: string
          question_index: number
          question_text: string
          sample_answer: string | null
          simulation_id: string
          star: Json
          structure_score: number
          transcript: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_sec?: number
          form_metrics?: Json
          id?: string
          lang?: string
          overall_note?: string
          question_index?: number
          question_text: string
          sample_answer?: string | null
          simulation_id: string
          star?: Json
          structure_score?: number
          transcript?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_sec?: number
          form_metrics?: Json
          id?: string
          lang?: string
          overall_note?: string
          question_index?: number
          question_text?: string
          sample_answer?: string | null
          simulation_id?: string
          star?: Json
          structure_score?: number
          transcript?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_responses_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "interview_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_simulations: {
        Row: {
          created_at: string
          difficulty: string
          format: string
          id: string
          interview_type: string
          lang: string
          questions: Json
          sector: string | null
          target_role: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: string
          format?: string
          id?: string
          interview_type?: string
          lang?: string
          questions?: Json
          sector?: string | null
          target_role?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          difficulty?: string
          format?: string
          id?: string
          interview_type?: string
          lang?: string
          questions?: Json
          sector?: string | null
          target_role?: string | null
          user_id?: string
        }
        Relationships: []
      }
      lesson_completions: {
        Row: {
          completed_at: string
          duration_sec: number | null
          feedback: string | null
          id: string
          lesson_id: string
          quiz_score: number | null
          quiz_total: number | null
          transcript: string | null
          user_id: string
          wpm: number | null
        }
        Insert: {
          completed_at?: string
          duration_sec?: number | null
          feedback?: string | null
          id?: string
          lesson_id: string
          quiz_score?: number | null
          quiz_total?: number | null
          transcript?: string | null
          user_id: string
          wpm?: number | null
        }
        Update: {
          completed_at?: string
          duration_sec?: number | null
          feedback?: string | null
          id?: string
          lesson_id?: string
          quiz_score?: number | null
          quiz_total?: number | null
          transcript?: string | null
          user_id?: string
          wpm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content_en: string
          content_fr: string
          created_at: string
          exercise_prompt_en: string
          exercise_prompt_fr: string
          id: string
          order_index: number
          slug: string
          target_seconds: number
          theme: string
          title_en: string
          title_fr: string
        }
        Insert: {
          content_en: string
          content_fr: string
          created_at?: string
          exercise_prompt_en: string
          exercise_prompt_fr: string
          id?: string
          order_index: number
          slug: string
          target_seconds?: number
          theme: string
          title_en: string
          title_fr: string
        }
        Update: {
          content_en?: string
          content_fr?: string
          created_at?: string
          exercise_prompt_en?: string
          exercise_prompt_fr?: string
          id?: string
          order_index?: number
          slug?: string
          target_seconds?: number
          theme?: string
          title_en?: string
          title_fr?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          availability: string | null
          baseline_wpm: number | null
          created_at: string
          display_name: string | null
          goal: string | null
          id: string
          last_reminder_at: string | null
          last_weekly_reminder_at: string | null
          level: string | null
          notifications_enabled: boolean
          onboarding_completed: boolean
          quiet_end_hour_utc: number | null
          quiet_start_hour_utc: number | null
          reminder_hour_utc: number
          theme_prefs: Json
          theme_prefs_updated: Json
          ui_lang: string
          updated_at: string
          weekly_reminder_dow: number
          weekly_reminder_enabled: boolean
          weekly_reminder_hour_utc: number
        }
        Insert: {
          availability?: string | null
          baseline_wpm?: number | null
          created_at?: string
          display_name?: string | null
          goal?: string | null
          id: string
          last_reminder_at?: string | null
          last_weekly_reminder_at?: string | null
          level?: string | null
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          quiet_end_hour_utc?: number | null
          quiet_start_hour_utc?: number | null
          reminder_hour_utc?: number
          theme_prefs?: Json
          theme_prefs_updated?: Json
          ui_lang?: string
          updated_at?: string
          weekly_reminder_dow?: number
          weekly_reminder_enabled?: boolean
          weekly_reminder_hour_utc?: number
        }
        Update: {
          availability?: string | null
          baseline_wpm?: number | null
          created_at?: string
          display_name?: string | null
          goal?: string | null
          id?: string
          last_reminder_at?: string | null
          last_weekly_reminder_at?: string | null
          level?: string | null
          notifications_enabled?: boolean
          onboarding_completed?: boolean
          quiet_end_hour_utc?: number | null
          quiet_start_hour_utc?: number | null
          reminder_hour_utc?: number
          theme_prefs?: Json
          theme_prefs_updated?: Json
          ui_lang?: string
          updated_at?: string
          weekly_reminder_dow?: number
          weekly_reminder_enabled?: boolean
          weekly_reminder_hour_utc?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          questions: Json
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          questions: Json
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          questions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: true
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      streaks: {
        Row: {
          current_streak: number
          grace_last_used: string | null
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          grace_last_used?: string | null
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          grace_last_used?: string | null
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
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
      video_sessions: {
        Row: {
          created_at: string
          duration_sec: number
          gaze_camera_pct: number
          hesitation_metrics: Json
          id: string
          lang: string
          markers: Json
          posture_metrics: Json
          prompt: string | null
          suggestions: Json
          summary: string | null
          transcript: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_sec: number
          gaze_camera_pct?: number
          hesitation_metrics?: Json
          id?: string
          lang?: string
          markers?: Json
          posture_metrics?: Json
          prompt?: string | null
          suggestions?: Json
          summary?: string | null
          transcript?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          duration_sec?: number
          gaze_camera_pct?: number
          hesitation_metrics?: Json
          id?: string
          lang?: string
          markers?: Json
          posture_metrics?: Json
          prompt?: string | null
          suggestions?: Json
          summary?: string | null
          transcript?: string | null
          user_id?: string
        }
        Relationships: []
      }
      weekly_coaching: {
        Row: {
          created_at: string
          exercises: Json
          id: string
          lang: string
          metrics: Json
          priority_skill: string
          progress_note: string | null
          progression: Json
          sample_size: number
          summary: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          created_at?: string
          exercises?: Json
          id?: string
          lang?: string
          metrics?: Json
          priority_skill: string
          progress_note?: string | null
          progression?: Json
          sample_size?: number
          summary: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          created_at?: string
          exercises?: Json
          id?: string
          lang?: string
          metrics?: Json
          priority_skill?: string
          progress_note?: string | null
          progression?: Json
          sample_size?: number
          summary?: string
          updated_at?: string
          user_id?: string
          week_start?: string
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
