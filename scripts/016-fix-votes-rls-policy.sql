-- Fix RLS policy for votes table to allow voting during voting phase
-- The current policy only checks voter_id, but doesn't verify room_id, target_id, or phase

-- Drop existing policies
DROP POLICY IF EXISTS "Players can cast votes" ON votes;
DROP POLICY IF EXISTS "Players can update votes" ON votes;

-- Create improved INSERT policy that checks:
-- 1. The voter is a player in the room and belongs to current user
-- 2. The voter is in the same room as specified in room_id
-- 3. The voter is not eliminated
-- 4. The target exists and is in the same room (and not eliminated)
CREATE POLICY "Players can cast votes" ON votes FOR INSERT WITH CHECK (
  -- Check that voter exists, belongs to current user, is in the room, and is not eliminated
  EXISTS (
    SELECT 1 FROM game_players gp
    WHERE gp.id = voter_id 
    AND gp.user_id = auth.uid()
    AND gp.room_id = room_id
    AND gp.is_eliminated = FALSE
  )
  -- Check that target exists and is in the same room (and not eliminated)
  AND EXISTS (
    SELECT 1 FROM game_players gp
    WHERE gp.id = target_id
    AND gp.room_id = room_id
    AND gp.is_eliminated = FALSE
  )
);

-- Create UPDATE policy for upsert operations (when changing vote)
CREATE POLICY "Players can update votes" ON votes FOR UPDATE USING (
  -- Check that the existing vote belongs to current user
  EXISTS (
    SELECT 1 FROM game_players gp
    WHERE gp.id = voter_id 
    AND gp.user_id = auth.uid()
    AND gp.room_id = room_id
    AND gp.is_eliminated = FALSE
  )
) WITH CHECK (
  -- Check that voter exists, belongs to current user, is in the room, and is not eliminated
  EXISTS (
    SELECT 1 FROM game_players gp
    WHERE gp.id = voter_id 
    AND gp.user_id = auth.uid()
    AND gp.room_id = room_id
    AND gp.is_eliminated = FALSE
  )
  -- Check that target exists and is in the same room (and not eliminated)
  AND EXISTS (
    SELECT 1 FROM game_players gp
    WHERE gp.id = target_id
    AND gp.room_id = room_id
    AND gp.is_eliminated = FALSE
  )
);
