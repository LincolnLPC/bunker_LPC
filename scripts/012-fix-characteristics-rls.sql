-- Fix RLS policies for player_characteristics to allow:
-- 1. Players to view their own characteristics (even if hidden)
-- 2. Host to view all characteristics in their room
-- 3. Players to insert their own characteristics (via API)
-- 4. Anyone in the room to view revealed characteristics

-- Drop existing policies (use IF EXISTS to avoid errors if they don't exist)
DROP POLICY IF EXISTS "Anyone can view revealed characteristics" ON player_characteristics;
DROP POLICY IF EXISTS "Players can update own characteristics" ON player_characteristics;
DROP POLICY IF EXISTS "Host can update any characteristics" ON player_characteristics;
DROP POLICY IF EXISTS "Players can view own characteristics" ON player_characteristics;
DROP POLICY IF EXISTS "Host can view all characteristics in room" ON player_characteristics;
DROP POLICY IF EXISTS "Users can insert characteristics for own player" ON player_characteristics;
DROP POLICY IF EXISTS "Service role can insert characteristics" ON player_characteristics;

-- Allow players to view their own characteristics (even if hidden)
CREATE POLICY "Players can view own characteristics" ON player_characteristics FOR SELECT USING (
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid())
);

-- Allow host to view all characteristics in their room
CREATE POLICY "Host can view all characteristics in room" ON player_characteristics FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM game_players gp 
    JOIN game_rooms gr ON gp.room_id = gr.id 
    WHERE gp.id = player_id AND gr.host_id = auth.uid()
  )
);

-- Allow anyone in the room to view revealed characteristics
CREATE POLICY "Anyone can view revealed characteristics" ON player_characteristics FOR SELECT USING (
  is_revealed = true AND
  EXISTS (
    SELECT 1 FROM game_players gp
    JOIN game_rooms gr ON gp.room_id = gr.id
    WHERE gp.id = player_id
    AND (
      -- Current user is a player in the room
      EXISTS (SELECT 1 FROM game_players WHERE room_id = gr.id AND user_id = auth.uid())
      -- OR current user is the host
      OR gr.host_id = auth.uid()
    )
  )
);

-- Allow authenticated users to insert characteristics for players they created
-- This is needed when a player joins a room and characteristics are created via API
-- The user must be authenticated and must own the player record
CREATE POLICY "Users can insert characteristics for own player" ON player_characteristics FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid())
);

-- Allow players to update their own characteristics
CREATE POLICY "Players can update own characteristics" ON player_characteristics FOR UPDATE USING (
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid())
);

-- Allow host to update any characteristics in their room
CREATE POLICY "Host can update any characteristics" ON player_characteristics FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM game_players gp 
    JOIN game_rooms gr ON gp.room_id = gr.id 
    WHERE gp.id = player_id AND gr.host_id = auth.uid()
  )
);

-- Add a comment explaining the policies
COMMENT ON POLICY "Players can view own characteristics" ON player_characteristics IS 
'Allows players to view all their own characteristics, even if hidden. This is necessary for the player to see their own characteristics in the UI.';

COMMENT ON POLICY "Host can view all characteristics in room" ON player_characteristics IS 
'Allows the host to view all characteristics of all players in their room, necessary for host controls.';

COMMENT ON POLICY "Anyone can view revealed characteristics" ON player_characteristics IS 
'Allows anyone in the room (players or host) to view characteristics that have been revealed.';

COMMENT ON POLICY "Users can insert characteristics for own player" ON player_characteristics IS 
'Allows authenticated users to insert characteristics for players they own when joining rooms via API.';
