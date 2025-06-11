export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          date_of_birth: string | null
          gender: string | null
          height: number | null
          weight: number | null
          emergency_contact: string | null
          medical_conditions: string[]
          medications: string[]
          privacy_settings: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: string | null
          height?: number | null
          weight?: number | null
          emergency_contact?: string | null
          medical_conditions?: string[]
          medications?: string[]
          privacy_settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          date_of_birth?: string | null
          gender?: string | null
          height?: number | null
          weight?: number | null
          emergency_contact?: string | null
          medical_conditions?: string[]
          medications?: string[]
          privacy_settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      health_metrics: {
        Row: {
          id: string
          user_id: string
          metric_type: string
          value: number | null
          unit: string
          systolic: number | null
          diastolic: number | null
          notes: string | null
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          metric_type: string
          value?: number | null
          unit: string
          systolic?: number | null
          diastolic?: number | null
          notes?: string | null
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          metric_type?: string
          value?: number | null
          unit?: string
          systolic?: number | null
          diastolic?: number | null
          notes?: string | null
          recorded_at?: string
          created_at?: string
        }
      }
      chat_messages: {
        Row: {
          id: string
          user_id: string
          message: string
          sender_type: string
          message_type: string
          metadata: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          message: string
          sender_type: string
          message_type?: string
          metadata?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          message?: string
          sender_type?: string
          message_type?: string
          metadata?: Record<string, any>
          created_at?: string
        }
      }
      analytics_data: {
        Row: {
          id: string
          user_id: string
          metric_type: string
          aggregation_period: string
          date_period: string
          value: number
          metadata: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          metric_type: string
          aggregation_period: string
          date_period: string
          value: number
          metadata?: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          metric_type?: string
          aggregation_period?: string
          date_period?: string
          value?: number
          metadata?: Record<string, any>
          created_at?: string
        }
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
  }
}