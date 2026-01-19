-- Grant Admin Role to User
-- This script grants admin or moderator role to a user
-- 
-- Usage:
-- 1. First, find your user using the search queries below
-- 2. Replace 'USER_EMAIL_HERE' with the actual user email, OR
-- 3. Replace 'USER_ID_HERE' with the actual user UUID
-- 4. Choose 'admin' or 'moderator' role
-- 5. Run this script in Supabase SQL Editor

-- ============================================
-- STEP 1: FIND YOUR USER (Run this first!)
-- ============================================
-- Uncomment and run one of these queries to find your user:

-- Search by email (exact match):
-- SELECT id, email, created_at, email_confirmed_at 
-- FROM auth.users 
-- WHERE email = 'user@example.com';

-- Search by email (case-insensitive, partial match):
-- SELECT id, email, created_at, email_confirmed_at 
-- FROM auth.users 
-- WHERE LOWER(email) LIKE LOWER('%part_of_email%');

-- Search by username:
-- SELECT p.id, p.username, p.display_name, u.email, u.created_at
-- FROM profiles p
-- JOIN auth.users u ON u.id = p.id
-- WHERE p.username = 'myusername';

-- List all users (first 20):
-- SELECT u.id, u.email, u.created_at, p.username, p.display_name
-- FROM auth.users u
-- LEFT JOIN profiles p ON p.id = u.id
-- ORDER BY u.created_at DESC
-- LIMIT 20;

-- ============================================
-- STEP 2: GRANT ADMIN ROLE
-- ============================================

-- Option 1: Grant admin role by email (case-insensitive)
DO $$
DECLARE
  target_user_id UUID;
  target_email TEXT := 'USER_EMAIL_HERE'; -- REPLACE WITH ACTUAL EMAIL
  admin_role TEXT := 'admin'; -- Change to 'moderator' if needed
  user_email TEXT;
BEGIN
  -- Find user by email (case-insensitive)
  SELECT id, email INTO target_user_id, user_email
  FROM auth.users
  WHERE LOWER(email) = LOWER(target_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email "%" not found. Please check the email or use the search queries above to find the correct email.', target_email;
  END IF;
  
  RAISE NOTICE 'Found user: % (email: %)', target_user_id, user_email;
  
  -- Check if user has a profile
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User profile does not exist. User must have a profile first. Creating profile...';
    -- Try to create profile automatically
    INSERT INTO profiles (id, username, subscription_tier)
    VALUES (
      target_user_id, 
      COALESCE(
        (SELECT username FROM profiles WHERE id = target_user_id),
        'user_' || SUBSTRING(target_user_id::TEXT, 1, 8)
      ),
      'basic'
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  -- Insert or update admin role
  INSERT INTO admin_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, admin_role, target_user_id, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = admin_role,
    granted_at = NOW();
  
  RAISE NOTICE '✓ Admin role "%" granted successfully to user: % (email: %)', admin_role, target_user_id, user_email;
END $$;

-- Option 2: Grant admin role by user_id (UUID)
-- Uncomment and use this if you know the user_id directly
/*
DO $$
DECLARE
  target_user_id UUID := 'USER_ID_HERE'::UUID; -- REPLACE WITH ACTUAL UUID
  admin_role TEXT := 'admin'; -- Change to 'moderator' if needed
  user_email TEXT;
BEGIN
  -- Check if user exists and get email
  SELECT email INTO user_email
  FROM auth.users 
  WHERE id = target_user_id;
  
  IF user_email IS NULL THEN
    RAISE EXCEPTION 'User with id "%" not found', target_user_id;
  END IF;
  
  RAISE NOTICE 'Found user: % (email: %)', target_user_id, user_email;
  
  -- Check if user has a profile
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User profile does not exist. User must have a profile first.';
  END IF;
  
  -- Insert or update admin role
  INSERT INTO admin_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, admin_role, target_user_id, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = admin_role,
    granted_at = NOW();
  
  RAISE NOTICE '✓ Admin role "%" granted successfully to user: % (email: %)', admin_role, target_user_id, user_email;
END $$;
*/

-- Option 3: Grant admin role by username (from profiles table)
-- Uncomment and use this if you know the username
/*
DO $$
DECLARE
  target_user_id UUID;
  target_username TEXT := 'USERNAME_HERE'; -- REPLACE WITH ACTUAL USERNAME
  admin_role TEXT := 'admin'; -- Change to 'moderator' if needed
  user_email TEXT;
  user_display_name TEXT;
BEGIN
  -- Find user by username
  SELECT p.id, u.email, p.display_name 
  INTO target_user_id, user_email, user_display_name
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.username = target_username;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with username "%" not found', target_username;
  END IF;
  
  RAISE NOTICE 'Found user: % (username: %, email: %)', target_user_id, target_username, user_email;
  
  -- Insert or update admin role
  INSERT INTO admin_roles (user_id, role, granted_by, granted_at)
  VALUES (target_user_id, admin_role, target_user_id, NOW())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    role = admin_role,
    granted_at = NOW();
  
  RAISE NOTICE '✓ Admin role "%" granted successfully to user: % (username: %, email: %)', admin_role, target_user_id, target_username, user_email;
END $$;
*/

-- Query to check current admins
-- Uncomment to see all current admins and moderators
/*
SELECT 
  ar.id,
  ar.user_id,
  ar.role,
  ar.granted_at,
  p.username,
  p.display_name,
  u.email
FROM admin_roles ar
JOIN profiles p ON p.id = ar.user_id
JOIN auth.users u ON u.id = ar.user_id
ORDER BY ar.granted_at DESC;
*/

-- Query to remove admin role
-- Uncomment and use this to remove admin role from a user
/*
DELETE FROM admin_roles 
WHERE user_id = 'USER_ID_HERE'::UUID; -- REPLACE WITH ACTUAL UUID
-- OR
DELETE FROM admin_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'USER_EMAIL_HERE');
*/
