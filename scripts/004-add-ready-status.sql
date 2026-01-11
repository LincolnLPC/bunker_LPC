-- Add is_ready column to game_players table

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'game_players' AND column_name = 'is_ready'
  ) THEN
    ALTER TABLE game_players ADD COLUMN is_ready BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_players_ready ON game_players(room_id, is_ready);
