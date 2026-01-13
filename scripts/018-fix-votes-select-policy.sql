-- Fix RLS policy for votes table SELECT to allow viewing votes during voting phase
-- This is needed for the vote counts modal to work during voting

-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Players can view votes after round ends" ON votes;

-- Create new SELECT policy that allows viewing votes during voting phase and after
-- Players can see vote counts if they are in the room, during voting or after voting ends
CREATE POLICY "Players can view votes during voting and after" 
ON votes 
FOR SELECT 
USING (
  -- Allow viewing if player is in the room
  EXISTS (
    SELECT 1 
    FROM game_players gp
    JOIN game_rooms gr ON gp.room_id = gr.id
    WHERE gp.room_id = votes.room_id
      AND gp.user_id = auth.uid()
      AND (
        -- During voting phase (for vote counts display)
        gr.phase = 'voting' OR
        -- After voting ends (for results)
        gr.phase IN ('results', 'finished')
      )
  )
);

-- Verify the policy was created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'votes'
  AND policyname = 'Players can view votes during voting and after';
