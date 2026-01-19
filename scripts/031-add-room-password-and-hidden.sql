-- Add password and is_hidden fields to game_rooms table

-- Add password field (nullable, stores hashed password)
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS password TEXT;

-- Add is_hidden field (default false, rooms are visible by default)
ALTER TABLE game_rooms 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN game_rooms.password IS 'Hashed password for room access (null = no password)';
COMMENT ON COLUMN game_rooms.is_hidden IS 'If true, room will not appear in public room list';
