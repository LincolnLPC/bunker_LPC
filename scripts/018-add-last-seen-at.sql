-- Add last_seen_at column to game_players table for tracking player activity
-- This is used to detect inactive players who closed their browser tab

ALTER TABLE game_players 
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for efficient queries on last_seen_at
CREATE INDEX IF NOT EXISTS idx_game_players_last_seen_at ON game_players(last_seen_at);

-- Update existing players to have current timestamp
UPDATE game_players SET last_seen_at = NOW() WHERE last_seen_at IS NULL;
