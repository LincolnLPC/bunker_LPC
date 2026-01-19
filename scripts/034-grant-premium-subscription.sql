-- Grant Premium Subscription to User
-- This script grants premium subscription tier to a user for testing purposes
--
-- Usage:
-- Replace 'your_email@example.com' with your actual email below, then run the script

-- ============================================
-- OPTION 1: Grant premium by email (RECOMMENDED)
-- ============================================
-- Replace 'your_email@example.com' with your email:

DO $$
DECLARE
  target_user_id UUID;
  target_email TEXT := 'your_email@example.com'; -- ⚠️ CHANGE THIS to your email
BEGIN
  -- Find user by email
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = LOWER(target_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found. Make sure the email is correct.', target_email;
  END IF;

  -- Ensure profile exists and update to premium
  INSERT INTO profiles (id, username, subscription_tier)
  VALUES (
    target_user_id,
    COALESCE(
      (SELECT username FROM profiles WHERE id = target_user_id),
      'user_' || SUBSTRING(target_user_id::TEXT, 1, 8)
    ),
    'premium'
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    subscription_tier = 'premium',
    premium_expires_at = NULL, -- Permanent premium
    updated_at = NOW();

  RAISE NOTICE 'Premium subscription granted to user: % (ID: %)', target_email, target_user_id;
END $$;

-- ============================================
-- OPTION 2: Grant premium by user_id (if you know the UUID)
-- ============================================
-- Uncomment and replace 'your_user_id' with actual UUID:
/*
UPDATE profiles
SET subscription_tier = 'premium', 
    premium_expires_at = NULL,
    updated_at = NOW()
WHERE id = 'your_user_id'::UUID;
*/

-- ============================================
-- OPTION 3: Grant premium with expiration date
-- ============================================
-- Uncomment and replace values:
/*
DO $$
DECLARE
  target_user_id UUID;
  target_email TEXT := 'your_email@example.com';
  expiration_days INTEGER := 30; -- Premium expires in 30 days
BEGIN
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = LOWER(target_email);
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email % not found', target_email;
  END IF;

  INSERT INTO profiles (id, username, subscription_tier, premium_expires_at)
  VALUES (
    target_user_id,
    COALESCE(
      (SELECT username FROM profiles WHERE id = target_user_id),
      'user_' || SUBSTRING(target_user_id::TEXT, 1, 8)
    ),
    'premium',
    NOW() + (expiration_days || ' days')::INTERVAL
  )
  ON CONFLICT (id) 
  DO UPDATE SET 
    subscription_tier = 'premium',
    premium_expires_at = NOW() + (expiration_days || ' days')::INTERVAL,
    updated_at = NOW();

  RAISE NOTICE 'Premium subscription granted to % for % days', target_email, expiration_days;
END $$;
*/

-- ============================================
-- VERIFY: Check current subscription tier
-- ============================================
-- Run this to verify the subscription was granted:
/*
SELECT 
  p.id,
  p.username,
  p.subscription_tier,
  p.premium_expires_at,
  u.email
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'your_email@example.com';
*/
