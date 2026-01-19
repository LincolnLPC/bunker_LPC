-- Create spectators table for users watching ongoing games
-- Spectators can join games that have already started

CREATE TABLE IF NOT EXISTS game_spectators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  
  -- One spectator entry per user per room
  UNIQUE(room_id, user_id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_spectators_room_id ON game_spectators(room_id);
CREATE INDEX IF NOT EXISTS idx_spectators_user_id ON game_spectators(user_id);
CREATE INDEX IF NOT EXISTS idx_spectators_last_seen ON game_spectators(last_seen_at);

-- Enable RLS
ALTER TABLE game_spectators ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can view spectators (for displaying spectator list)
CREATE POLICY "Anyone can view spectators" ON game_spectators
  FOR SELECT
  USING (true);

-- Users can join as spectators
CREATE POLICY "Users can join as spectators" ON game_spectators
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own spectator entry (for last_seen_at)
CREATE POLICY "Users can update own spectator entry" ON game_spectators
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can leave (delete their own spectator entry)
CREATE POLICY "Users can leave as spectators" ON game_spectators
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE game_spectators IS 'Users watching ongoing games as spectators';
