-- SIMPLE VERSION: Fix RLS policy for votes table
-- This is a simpler version that should definitely work

-- Step 1: Drop existing policies
DROP POLICY IF EXISTS "Players can cast votes" ON votes;
DROP POLICY IF EXISTS "Players can update votes" ON votes;

-- Step 2: Create simple INSERT policy
-- This policy allows a user to insert a vote if:
-- - They are the voter (voter_id matches their user_id through game_players)
-- - The voter is in the same room as the vote
CREATE POLICY "Players can cast votes" 
ON votes 
FOR INSERT 
WITH CHECK (
  -- Check that voter belongs to current user and is in the room
  EXISTS (
    SELECT 1 
    FROM game_players gp
    WHERE gp.id = voter_id 
      AND gp.user_id = auth.uid()
      AND gp.room_id = room_id
      AND gp.is_eliminated = FALSE
  )
  -- Check that target is in the same room
  AND EXISTS (
    SELECT 1 
    FROM game_players gp
    WHERE gp.id = target_id
      AND gp.room_id = room_id
      AND gp.is_eliminated = FALSE
  )
);

-- Step 3: Create UPDATE policy for upsert operations
CREATE POLICY "Players can update votes" 
ON votes 
FOR UPDATE 
USING (
  -- Can update if voter belongs to current user
  EXISTS (
    SELECT 1 
    FROM game_players gp
    WHERE gp.id = voter_id 
      AND gp.user_id = auth.uid()
      AND gp.room_id = room_id
      AND gp.is_eliminated = FALSE
  )
)
WITH CHECK (
  -- After update, same checks as INSERT
  EXISTS (
    SELECT 1 
    FROM game_players gp
    WHERE gp.id = voter_id 
      AND gp.user_id = auth.uid()
      AND gp.room_id = room_id
      AND gp.is_eliminated = FALSE
  )
  AND EXISTS (
    SELECT 1 
    FROM game_players gp
    WHERE gp.id = target_id
      AND gp.room_id = room_id
      AND gp.is_eliminated = FALSE
  )
);

-- Verify policies were created
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'votes'
ORDER BY policyname;
