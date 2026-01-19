-- Add was_player field to game_spectators table
-- This field indicates if the spectator was previously a player in the game

ALTER TABLE game_spectators 
ADD COLUMN IF NOT EXISTS was_player BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN game_spectators.was_player IS 'Indicates if this spectator was previously a player in the game';
