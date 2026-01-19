-- Fix admin_roles RLS policy - remove infinite recursion
-- The problem: policy was checking admin_roles table within itself, causing recursion
-- Solution: Allow users to see only their own record, admins see all via separate logic

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can view admin roles" ON admin_roles;
DROP POLICY IF EXISTS "Users can view own admin role, admins can view all" ON admin_roles;

-- Create simple policy: users can only see their own admin role
-- This prevents recursion because it doesn't query admin_roles again
CREATE POLICY "Users can view own admin role" ON admin_roles
  FOR SELECT
  USING (user_id = auth.uid());

-- Note: For admins to see other admins, we would need a different approach,
-- but for now, this allows users to check their own status without recursion.
-- The admin page only needs to check the current user's status anyway.

-- Verify the policy
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'admin_roles';
