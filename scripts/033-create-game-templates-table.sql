-- Create game_templates table for saving game room settings
CREATE TABLE IF NOT EXISTS game_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  max_players INTEGER DEFAULT 12 CHECK (max_players IN (8, 12, 16, 20)),
  round_mode TEXT DEFAULT 'automatic' CHECK (round_mode IN ('manual', 'automatic')),
  discussion_time INTEGER DEFAULT 120,
  voting_time INTEGER DEFAULT 60,
  auto_reveal BOOLEAN DEFAULT FALSE,
  spectators BOOLEAN DEFAULT TRUE,
  host_role TEXT DEFAULT 'host_and_player' CHECK (host_role IN ('host_and_player', 'host_only')),
  catastrophe TEXT,
  bunker_description TEXT,
  exclude_non_binary_gender BOOLEAN DEFAULT FALSE,
  characteristics_settings JSONB DEFAULT '{}',
  custom_characteristics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable RLS on game_templates
ALTER TABLE game_templates ENABLE ROW LEVEL SECURITY;

-- Users can view their own templates
CREATE POLICY "Users can view own templates" ON game_templates FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own templates
CREATE POLICY "Users can create own templates" ON game_templates FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON game_templates FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON game_templates FOR DELETE USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_game_templates_user ON game_templates(user_id);
CREATE INDEX idx_game_templates_name ON game_templates(user_id, name);

-- Trigger for updated_at
CREATE TRIGGER game_templates_updated_at BEFORE UPDATE ON game_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
