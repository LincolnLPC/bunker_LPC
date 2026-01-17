-- Add bunker_info JSONB column to game_rooms table
-- This will store full bunker information including equipment and supplies

ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS bunker_info JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN game_rooms.bunker_info IS 'Full bunker information including equipment, supplies, area, capacity, duration, and threats';
