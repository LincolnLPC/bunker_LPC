-- Add rating and notification_settings to profiles

-- Rating: accumulated points (e.g. +5 per game, +20 per win)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rating'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rating INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Notification preferences (for future push/in-app notifications)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_settings JSONB DEFAULT '{"phaseChange": true, "invites": true}';
  END IF;
END $$;

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_rating_desc ON profiles (rating DESC NULLS LAST)
  WHERE rating > 0;

-- Function to add rating points (used when game ends)
CREATE OR REPLACE FUNCTION add_rating(user_id_param UUID, points_param INTEGER DEFAULT 0)
RETURNS void AS $$
BEGIN
  IF points_param IS NULL OR points_param <= 0 THEN
    RETURN;
  END IF;
  UPDATE profiles
  SET rating = COALESCE(rating, 0) + points_param,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION add_rating(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_rating(UUID, INTEGER) TO service_role;

-- Backfill rating for existing users (same formula: 5 per game, +20 per win)
UPDATE profiles
SET rating = COALESCE(games_played, 0) * 5 + COALESCE(games_won, 0) * 20
WHERE rating IS NULL OR rating = 0;
