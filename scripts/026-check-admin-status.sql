-- Diagnostic script to check admin status
-- Use this to verify if admin role was granted correctly

-- 1. Check if your user exists
SELECT 
  'User Info' as check_type,
  id as user_id,
  email,
  created_at
FROM auth.users
WHERE email = 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL

-- 2. Check if admin role exists for your user
SELECT 
  'Admin Role Check' as check_type,
  ar.id,
  ar.user_id,
  ar.role,
  ar.granted_at,
  u.email,
  p.username
FROM admin_roles ar
JOIN auth.users u ON u.id = ar.user_id
LEFT JOIN profiles p ON p.id = ar.user_id
WHERE u.email = 'Linc.lpc.1@gmail.com'; -- REPLACE WITH YOUR EMAIL

-- 3. Check all admin roles (if you can see them)
SELECT 
  'All Admin Roles' as check_type,
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

-- 4. Test if you can read your own admin role (using current auth.uid())
-- This will work after fixing RLS policy
SELECT 
  'My Admin Status' as check_type,
  ar.*
FROM admin_roles ar
WHERE ar.user_id = auth.uid();
