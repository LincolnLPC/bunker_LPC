-- Add metadata column to game_players table for special card effects

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'game_players' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE game_players ADD COLUMN metadata JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create index for metadata queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_game_players_metadata ON game_players USING GIN (metadata);
