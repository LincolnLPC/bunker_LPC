-- Complete diagnostic script for admin access issues
-- Run this to check everything step by step

-- ============================================
-- STEP 1: Verify user exists
-- ============================================
SELECT 
  'STEP 1: User Check' as step,
  id as user_id,
  email,
  created_at,
  email_confirmed_at
FROM auth.users
WHERE email = 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL

-- ============================================
-- STEP 2: Verify profile exists
-- ============================================
SELECT 
  'STEP 2: Profile Check' as step,
  p.id,
  p.username,
  p.display_name,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL

-- ============================================
-- STEP 3: Check admin_roles table directly (bypassing RLS)
-- This uses service role, so it should work regardless of RLS
-- ============================================
SELECT 
  'STEP 3: Admin Role Check (Direct)' as step,
  ar.id,
  ar.user_id,
  ar.role,
  ar.granted_at,
  ar.granted_by,
  u.email
FROM admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
WHERE u.email = 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL

-- ============================================
-- STEP 4: Check RLS policies on admin_roles
-- ============================================
SELECT 
  'STEP 4: RLS Policies Check' as step,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'admin_roles';

-- ============================================
-- STEP 5: Test if function works
-- ============================================
SELECT 
  'STEP 5: Function Test' as step,
  is_admin_or_moderator((SELECT id FROM auth.users WHERE email = 'Linc.lpc.1@gmail.com')::UUID) as is_admin; -- REPLACE WITH YOUR EMAIL

-- ============================================
-- STEP 6: Check all admin roles (if accessible)
-- ============================================
SELECT 
  'STEP 6: All Admin Roles' as step,
  ar.id,
  ar.user_id,
  ar.role,
  ar.granted_at,
  u.email,
  p.username
FROM admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
LEFT JOIN profiles p ON p.id = ar.user_id
ORDER BY ar.granted_at DESC;

-- ============================================
-- STEP 7: Re-grant admin role (if missing)
-- ============================================
-- Uncomment and run if admin role is missing:
/*
DO $$
DECLARE
  target_user_id UUID;
  target_email TEXT := 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(target_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Force insert/update admin role
  INSERT INTO admin_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, 'admin', target_user_id, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = 'admin',
    granted_at = NOW();
  
  RAISE NOTICE 'Admin role granted/updated for user: %', target_user_id;
END $$;
*/

-- ============================================
-- STEP 8: Fix RLS policy (if needed)
-- ============================================
-- Uncomment and run if RLS policy needs fixing:
/*
-- Drop old policy
DROP POLICY IF EXISTS "Admins can view admin roles" ON admin_roles;
DROP POLICY IF EXISTS "Users can view own admin role, admins can view all" ON admin_roles;

-- Create correct policy
CREATE POLICY "Users can view own admin role, admins can view all" ON admin_roles
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE ar.user_id = auth.uid()
    )
  );
*/
