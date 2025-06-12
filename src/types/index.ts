export interface User {
  id: string
  email: string
  email_confirmed_at?: string
  created_at: string
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  height?: number
  weight?: number
  emergency_contact?: string
  medical_conditions: string[]
  medications: string[]
  privacy_settings: PrivacySettings
  created_at: string
  updated_at: string
}

export interface PrivacySettings {
  data_sharing: boolean
  analytics: boolean
  notifications: boolean
}

export interface HealthMetric {
  id: string
  user_id: string
  metric_type: MetricType
  value?: number
  unit: string
  systolic?: number
  diastolic?: number
  notes?: string
  recorded_at: string
  created_at: string
}

export type MetricType = 
  | 'blood_pressure'
  | 'heart_rate'
  | 'weight'
  | 'blood_sugar'
  | 'temperature'
  | 'oxygen_saturation'
  | 'steps'
  | 'sleep_hours'
  | 'exercise_minutes'
  | 'water_intake'
  | 'mood_score'

export interface ChatMessage {
  id: string
  user_id: string
  message: string
  sender_type: 'user' | 'ai'
  message_type: 'text' | 'image' | 'file'
  metadata: Record<string, any>
  created_at: string
}

export interface AnalyticsData {
  id: string
  user_id: string
  metric_type: string
  aggregation_period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  date_period: string
  value: number
  metadata: Record<string, any>
  created_at: string
}

export interface ChartDataPoint {
  x: string | number
  y: number
  label?: string
}

export interface DashboardMetric {
  id: string
  title: string
  value: string | number
  unit?: string
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
  icon?: string
  color?: string
}

// Re-export vector types
export * from './vector'