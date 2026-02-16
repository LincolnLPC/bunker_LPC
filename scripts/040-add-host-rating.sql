-- Host rating (рейтинг ведущего)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'host_rating'
  ) THEN
    ALTER TABLE profiles ADD COLUMN host_rating INTEGER DEFAULT 0 NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_host_rating_desc ON profiles (host_rating DESC NULLS LAST)
  WHERE host_rating > 0;

CREATE OR REPLACE FUNCTION add_host_rating(user_id_param UUID, points_param INTEGER DEFAULT 0)
RETURNS void AS $$
BEGIN
  IF points_param IS NULL OR points_param <= 0 THEN
    RETURN;
  END IF;
  UPDATE profiles
  SET host_rating = COALESCE(host_rating, 0) + points_param,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION add_host_rating(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_host_rating(UUID, INTEGER) TO service_role;
