-- Fix admin_roles RLS policy to allow users to check their own admin status
-- This fixes the circular dependency issue where users can't read admin_roles
-- to check if they are admin, because the policy requires them to already be admin

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can view admin roles" ON admin_roles;

-- Create a new policy that allows:
-- 1. Users to view their own admin role (to check if they are admin)
-- 2. Admins to view all admin roles (for admin management)
CREATE POLICY "Users can view own admin role, admins can view all" ON admin_roles
  FOR SELECT
  USING (
    -- User can view their own role
    user_id = auth.uid()
    OR
    -- Or user is already an admin (for viewing other admins)
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE ar.user_id = auth.uid()
    )
  );

-- Also allow users to check their own admin status via the function
-- The function already uses SECURITY DEFINER, so it should work
-- But let's make sure it's correct
CREATE OR REPLACE FUNCTION is_admin_or_moderator(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_roles
    WHERE user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the fix by checking if you can see your admin role
-- Run this query to test (replace with your user_id):
-- SELECT * FROM admin_roles WHERE user_id = auth.uid();
