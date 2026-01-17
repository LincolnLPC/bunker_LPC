-- Fix RLS policies for player_characteristics to allow players to view all characteristics
-- of other players in the same room (needed for special cards like "Reveal")
-- This allows players to see hidden characteristics of others to use special cards,
-- but the UI should still only display revealed characteristics to non-hosts

-- Drop the restrictive policy if it exists
DROP POLICY IF EXISTS "Anyone can view revealed characteristics" ON player_characteristics;

-- Allow players in the same room to view all characteristics of other players
-- This is needed for special cards like "Reveal" to work
CREATE POLICY "Players in room can view all characteristics" ON player_characteristics FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM game_players gp1
    JOIN game_players gp2 ON gp1.room_id = gp2.room_id
    JOIN game_rooms gr ON gp1.room_id = gr.id
    WHERE gp2.id = player_id
    AND gp1.user_id = auth.uid()
    AND (
      -- Current user is a player in the same room
      gp1.room_id = gp2.room_id
      -- OR current user is the host
      OR gr.host_id = auth.uid()
    )
  )
);

-- Keep the existing policies for other operations
-- "Players can view own characteristics" - already exists
-- "Host can view all characteristics in room" - already exists
-- "Players can update own characteristics" - already exists
-- "Host can update any characteristics" - already exists
-- "Users can insert characteristics for own player" - already exists

COMMENT ON POLICY "Players in room can view all characteristics" ON player_characteristics IS 
'Allows players in the same room to view all characteristics of other players, including hidden ones. This is necessary for special cards like "Reveal" to work properly. The UI should still filter which characteristics to display based on is_revealed flag.';
