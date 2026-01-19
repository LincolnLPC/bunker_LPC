-- Add premium_expires_at field to profiles table
-- This allows setting expiration date for premium subscriptions

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_premium_expires ON profiles(premium_expires_at);

-- Add comment
COMMENT ON COLUMN profiles.premium_expires_at IS 'Expiration date for premium subscription. NULL means permanent premium or basic tier.';
