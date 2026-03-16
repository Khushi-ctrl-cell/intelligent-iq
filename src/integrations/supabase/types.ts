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
      ai_quality_metrics: {
        Row: {
          accuracy_rate: number
          created_at: string
          id: string
          questions_generated: number
          questions_rejected: number
          questions_verified: number
        }
        Insert: {
          accuracy_rate?: number
          created_at?: string
          id?: string
          questions_generated?: number
          questions_rejected?: number
          questions_verified?: number
        }
        Update: {
          accuracy_rate?: number
          created_at?: string
          id?: string
          questions_generated?: number
          questions_rejected?: number
          questions_verified?: number
        }
        Relationships: []
      }
      content_chunks: {
        Row: {
          chunk_index: number
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string
          subject: string | null
          text: string
          topic: string | null
        }
        Insert: {
          chunk_index: number
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id: string
          subject?: string | null
          text: string
          topic?: string | null
        }
        Update: {
          chunk_index?: number
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string
          subject?: string | null
          text?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          created_at: string | null
          difficulty_at_time: string | null
          id: string
          is_correct: boolean
          question_id: string | null
          selected_answer: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          difficulty_at_time?: string | null
          id?: string
          is_correct: boolean
          question_id?: string | null
          selected_answer: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          difficulty_at_time?: string | null
          id?: string
          is_correct?: boolean
          question_id?: string | null
          selected_answer?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          answer: string
          created_at: string | null
          difficulty: string | null
          id: string
          is_verified: boolean | null
          options: Json | null
          question: string
          question_hash: string | null
          source_chunk_id: string | null
          source_id: string | null
          type: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_verified?: boolean | null
          options?: Json | null
          question: string
          question_hash?: string | null
          source_chunk_id?: string | null
          source_id?: string | null
          type?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          difficulty?: string | null
          id?: string
          is_verified?: boolean | null
          options?: Json | null
          question?: string
          question_hash?: string | null
          source_chunk_id?: string | null
          source_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_source_chunk_id_fkey"
            columns: ["source_chunk_id"]
            isOneToOne: false
            referencedRelation: "content_chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          created_at: string | null
          file_url: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          file_url: string
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          file_url?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      student_topic_progress: {
        Row: {
          correct_count: number | null
          mastery_level: string | null
          student_id: string
          topic: string
          wrong_count: number | null
        }
        Insert: {
          correct_count?: number | null
          mastery_level?: string | null
          student_id: string
          topic: string
          wrong_count?: number | null
        }
        Update: {
          correct_count?: number | null
          mastery_level?: string | null
          student_id?: string
          topic?: string
          wrong_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
