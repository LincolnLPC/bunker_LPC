-- Check current RLS policies for votes table
-- Run this to see what policies are currently active

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'votes';

-- List all policies on votes table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'votes';

-- Test if current user can insert votes (this will show the error if policy fails)
-- Note: This is just for checking, don't actually insert
-- SELECT auth.uid() as current_user_id;
