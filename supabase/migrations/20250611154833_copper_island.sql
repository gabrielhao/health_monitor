/*
  # Create analytics data table

  1. New Tables
    - `analytics_data`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `metric_type` (text, the type of metric being tracked)
      - `aggregation_period` (text, 'daily', 'weekly', 'monthly')
      - `date_period` (date, the date/period this data represents)
      - `value` (numeric, aggregated value)
      - `metadata` (jsonb, additional analysis data)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `analytics_data` table
    - Add policies for authenticated users to access their own analytics
*/

CREATE TABLE IF NOT EXISTS analytics_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  metric_type text NOT NULL,
  aggregation_period text NOT NULL CHECK (aggregation_period IN ('daily', 'weekly', 'monthly', 'yearly')),
  date_period date NOT NULL,
  value numeric(12,4) NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_data ENABLE ROW LEVEL SECURITY;

-- Policy for users to read their own analytics
CREATE POLICY "Users can read own analytics data"
  ON analytics_data
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for users to insert their own analytics
CREATE POLICY "Users can insert own analytics data"
  ON analytics_data
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_analytics_user_id ON analytics_data(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON analytics_data(user_id, metric_type, aggregation_period, date_period DESC);

-- Unique constraint to prevent duplicate analytics entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_unique 
ON analytics_data(user_id, metric_type, aggregation_period, date_period);