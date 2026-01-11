-- SQL functions for atomic statistics updates
-- These can be used instead of fetching and updating separately for better performance

-- Function to increment games_played
CREATE OR REPLACE FUNCTION increment_games_played(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET games_played = COALESCE(games_played, 0) + 1,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Function to increment games_won
CREATE OR REPLACE FUNCTION increment_games_won(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET games_won = COALESCE(games_won, 0) + 1,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_games_played(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_games_won(UUID) TO authenticated;
