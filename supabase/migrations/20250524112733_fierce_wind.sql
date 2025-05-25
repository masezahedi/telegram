/*
  # Add API key and forwarding services tables

  1. New Tables
    - `user_settings`
      - `user_id` (text, foreign key to users)
      - `gemini_api_key` (text, nullable)
      - `updated_at` (timestamp)
    
    - `forwarding_services`
      - `id` (text, primary key)
      - `user_id` (text, foreign key to users)
      - `name` (text)
      - `source_channels` (text[])
      - `target_channels` (text[])
      - `search_replace_rules` (jsonb)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `activated_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users
*/

-- User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  gemini_api_key TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own settings"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- Forwarding Services Table
CREATE TABLE IF NOT EXISTS forwarding_services (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id),
  name TEXT NOT NULL,
  source_channels TEXT[] NOT NULL,
  target_channels TEXT[] NOT NULL,
  search_replace_rules JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE forwarding_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own services"
  ON forwarding_services
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own services"
  ON forwarding_services
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own services"
  ON forwarding_services
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own services"
  ON forwarding_services
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);