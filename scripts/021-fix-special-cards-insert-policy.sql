-- Fix RLS policy for special_cards INSERT to allow host to grant cards
-- This allows the host to insert cards for all players in their room when starting the game

-- Drop the existing policy that only allows service role
DROP POLICY IF EXISTS "Service role can insert special cards" ON special_cards;

-- Create policy that allows host to insert cards for players in their room
CREATE POLICY "Host can insert special cards for room players" ON special_cards FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM game_rooms gr
    JOIN game_players gp ON gr.id = gp.room_id
    WHERE gr.id = room_id
    AND gr.host_id = auth.uid()
    AND gp.id = player_id
  )
);

-- Also keep the service role policy as fallback (for admin operations)
CREATE POLICY "Service role can insert special cards" ON special_cards FOR INSERT 
WITH CHECK (true);

-- Add comment explaining the policies
COMMENT ON POLICY "Host can insert special cards for room players" ON special_cards IS 
'Allows room host to insert special cards for players in their room when starting the game';

COMMENT ON POLICY "Service role can insert special cards" ON special_cards IS 
'Allows service role (admin) to insert special cards bypassing RLS';
