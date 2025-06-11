/*
  # Create health metrics table

  1. New Tables
    - `health_metrics`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `metric_type` (text, e.g., 'blood_pressure', 'heart_rate', 'weight', 'blood_sugar', etc.)
      - `value` (numeric, the main measurement value)
      - `unit` (text, measurement unit)
      - `systolic` (numeric, for blood pressure)
      - `diastolic` (numeric, for blood pressure)
      - `notes` (text, optional notes)
      - `recorded_at` (timestamp, when the measurement was taken)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `health_metrics` table
    - Add policies for authenticated users to manage their own metrics
*/

CREATE TABLE IF NOT EXISTS health_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  metric_type text NOT NULL CHECK (metric_type IN (
    'blood_pressure', 'heart_rate', 'weight', 'blood_sugar', 
    'temperature', 'oxygen_saturation', 'steps', 'sleep_hours',
    'exercise_minutes', 'water_intake', 'mood_score'
  )),
  value numeric(10,2),
  unit text NOT NULL,
  systolic numeric(5,1), -- for blood pressure
  diastolic numeric(5,1), -- for blood pressure
  notes text,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own metrics
CREATE POLICY "Users can read own health metrics"
  ON health_metrics
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for users to insert their own metrics
CREATE POLICY "Users can insert own health metrics"
  ON health_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to update their own metrics
CREATE POLICY "Users can update own health metrics"
  ON health_metrics
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to delete their own metrics
CREATE POLICY "Users can delete own health metrics"
  ON health_metrics
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_health_metrics_user_id ON health_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_health_metrics_type_date ON health_metrics(user_id, metric_type, recorded_at DESC);