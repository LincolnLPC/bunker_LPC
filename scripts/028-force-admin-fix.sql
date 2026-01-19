-- Force fix admin access - complete solution
-- Run this script to ensure admin access works

-- Step 1: Verify and create admin role (using service role bypass)
DO $$
DECLARE
  target_user_id UUID;
  target_email TEXT := 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL
BEGIN
  -- Find user
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(target_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email "%" not found', target_email;
  END IF;
  
  RAISE NOTICE 'Found user: %', target_user_id;
  
  -- Ensure profile exists
  INSERT INTO profiles (id, username, subscription_tier)
  VALUES (
    target_user_id,
    COALESCE(
      (SELECT username FROM profiles WHERE id = target_user_id),
      'user_' || SUBSTRING(target_user_id::TEXT, 1, 8)
    ),
    'basic'
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(profiles.username, 'user_' || SUBSTRING(target_user_id::TEXT, 1, 8));
  
  -- Force insert/update admin role
  INSERT INTO admin_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, 'admin', target_user_id, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = 'admin',
    granted_at = NOW();
  
  RAISE NOTICE '✓ Admin role granted/updated for user: %', target_user_id;
END $$;

-- Step 2: Fix RLS policy (drop all and recreate)
DROP POLICY IF EXISTS "Admins can view admin roles" ON admin_roles;
DROP POLICY IF EXISTS "Users can view own admin role, admins can view all" ON admin_roles;

-- Create the correct policy
CREATE POLICY "Users can view own admin role, admins can view all" ON admin_roles
  FOR SELECT
  USING (
    -- Allow user to see their own admin role
    user_id = auth.uid()
    OR
    -- Allow admins to see all admin roles
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE ar.user_id = auth.uid()
    )
  );

-- Step 3: Verify the fix
SELECT 
  'Verification' as step,
  ar.id,
  ar.user_id,
  ar.role,
  ar.granted_at,
  u.email,
  p.username,
  CASE 
    WHEN ar.user_id = (SELECT id FROM auth.users WHERE email = 'Linc.lpc.1@gmail.com' LIMIT 1) 
    THEN '✓ This is your admin role'
    ELSE 'Other admin'
  END as status
FROM admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
LEFT JOIN profiles p ON p.id = ar.user_id
WHERE u.email = 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL

-- Step 4: Test RLS policy (this should work now)
-- Note: This will only work if you're logged in as that user
-- SELECT * FROM admin_roles WHERE user_id = auth.uid();
