-- Achievements fixes: first game for all players, games = played + hosted, social = rooms started, premium = has or had, whoami achievements
-- Run after 036-create-achievements-system.sql and 040-add-host-rating.sql

-- 1. Add columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS games_hosted INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS games_played_whoami INTEGER DEFAULT 0;

-- 2. Increment functions for host and whoami
CREATE OR REPLACE FUNCTION increment_games_hosted(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET games_hosted = COALESCE(games_hosted, 0) + 1,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_games_played_whoami(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET games_played_whoami = COALESCE(games_played_whoami, 0) + 1,
      updated_at = NOW()
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION increment_games_hosted(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_games_hosted(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION increment_games_played_whoami(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_games_played_whoami(UUID) TO service_role;

-- 3. Allow 'whoami' category in achievements (drop old check, add new)
ALTER TABLE achievements DROP CONSTRAINT IF EXISTS achievements_category_check;
ALTER TABLE achievements ADD CONSTRAINT achievements_category_check
  CHECK (category IN ('general', 'games', 'wins', 'social', 'premium', 'special', 'whoami'));

-- 4. Update social achievements description
UPDATE achievements SET description = 'Создайте и запустите игру в 10 комнатах (бункер или Кто я?)' WHERE code = 'host_10';
UPDATE achievements SET description = 'Создайте и запустите игру в 50 комнатах (бункер или Кто я?)' WHERE code = 'host_50';

-- 5. Insert whoami achievements
INSERT INTO achievements (code, name, description, icon, category, requirement_value, tier, points) VALUES
  ('whoami_first', 'Первая игра «Кто я?»', 'Сыграйте первую игру в режиме «Кто я?»', 'help-circle', 'whoami', 1, 'bronze', 15),
  ('whoami_10', 'Знаток «Кто я?»', 'Сыграйте 10 игр в режиме «Кто я?»', 'users', 'whoami', 10, 'bronze', 75),
  ('whoami_50', 'Мастер «Кто я?»', 'Сыграйте 50 игр в режиме «Кто я?»', 'award', 'whoami', 50, 'silver', 300)
ON CONFLICT (code) DO NOTHING;

-- 6. Replace check_and_award_achievement: use (games_played + games_hosted) for games, games_hosted for social, premium check, whoami
CREATE OR REPLACE FUNCTION check_and_award_achievement(
  user_id_param UUID,
  achievement_code_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  achievement_record RECORD;
  user_stats RECORD;
  should_award BOOLEAN := false;
  total_games INTEGER;
BEGIN
  SELECT * INTO achievement_record
  FROM achievements
  WHERE code = achievement_code_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = user_id_param AND achievement_id = achievement_record.id) THEN
    RETURN false;
  END IF;

  -- Get user stats including new columns and premium
  SELECT p.games_played, p.games_won,
         COALESCE(p.games_hosted, 0) AS games_hosted,
         COALESCE(p.games_played_whoami, 0) AS games_played_whoami,
         p.subscription_tier, p.premium_expires_at
  INTO user_stats
  FROM profiles p
  WHERE p.id = user_id_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  total_games := COALESCE(user_stats.games_played, 0) + COALESCE(user_stats.games_hosted, 0);

  CASE achievement_code_param
    -- General: first game = any participation (player or host)
    WHEN 'first_game' THEN
      should_award := total_games >= 1;

    -- Games: all games (as player + as host)
    WHEN 'games_10' THEN
      should_award := total_games >= 10;
    WHEN 'games_50' THEN
      should_award := total_games >= 50;
    WHEN 'games_100' THEN
      should_award := total_games >= 100;
    WHEN 'games_500' THEN
      should_award := total_games >= 500;

    -- Wins (unchanged)
    WHEN 'first_win' THEN
      should_award := user_stats.games_won >= 1;
    WHEN 'wins_5' THEN
      should_award := user_stats.games_won >= 5;
    WHEN 'wins_25' THEN
      should_award := user_stats.games_won >= 25;
    WHEN 'wins_100' THEN
      should_award := user_stats.games_won >= 100;
    WHEN 'win_rate_50' THEN
      IF total_games >= 10 THEN
        should_award := (user_stats.games_won::FLOAT / NULLIF(total_games, 0) * 100) >= 50;
      END IF;
    WHEN 'win_rate_75' THEN
      IF total_games >= 20 THEN
        should_award := (user_stats.games_won::FLOAT / NULLIF(total_games, 0) * 100) >= 75;
      END IF;

    -- Social: rooms created and game started (any mode)
    WHEN 'host_10' THEN
      should_award := COALESCE(user_stats.games_hosted, 0) >= 10;
    WHEN 'host_50' THEN
      should_award := COALESCE(user_stats.games_hosted, 0) >= 50;

    -- Premium: has or had premium
    WHEN 'premium_subscriber' THEN
      should_award := (user_stats.subscription_tier = 'premium') OR (user_stats.premium_expires_at IS NOT NULL);

    -- Whoami
    WHEN 'whoami_first' THEN
      should_award := COALESCE(user_stats.games_played_whoami, 0) >= 1;
    WHEN 'whoami_10' THEN
      should_award := COALESCE(user_stats.games_played_whoami, 0) >= 10;
    WHEN 'whoami_50' THEN
      should_award := COALESCE(user_stats.games_played_whoami, 0) >= 50;

    ELSE
      RETURN false;
  END CASE;

  IF should_award THEN
    INSERT INTO user_achievements (user_id, achievement_id, progress)
    VALUES (user_id_param, achievement_record.id, 100)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. check_all_achievements: add whoami and premium
CREATE OR REPLACE FUNCTION check_all_achievements(user_id_param UUID)
RETURNS TABLE(achievement_code TEXT, awarded BOOLEAN) AS $$
BEGIN
  PERFORM check_and_award_achievement(user_id_param, 'first_game');
  PERFORM check_and_award_achievement(user_id_param, 'games_10');
  PERFORM check_and_award_achievement(user_id_param, 'games_50');
  PERFORM check_and_award_achievement(user_id_param, 'games_100');
  PERFORM check_and_award_achievement(user_id_param, 'games_500');
  PERFORM check_and_award_achievement(user_id_param, 'first_win');
  PERFORM check_and_award_achievement(user_id_param, 'wins_5');
  PERFORM check_and_award_achievement(user_id_param, 'wins_25');
  PERFORM check_and_award_achievement(user_id_param, 'wins_100');
  PERFORM check_and_award_achievement(user_id_param, 'win_rate_50');
  PERFORM check_and_award_achievement(user_id_param, 'win_rate_75');
  PERFORM check_and_award_achievement(user_id_param, 'host_10');
  PERFORM check_and_award_achievement(user_id_param, 'host_50');
  PERFORM check_and_award_achievement(user_id_param, 'premium_subscriber');
  PERFORM check_and_award_achievement(user_id_param, 'whoami_first');
  PERFORM check_and_award_achievement(user_id_param, 'whoami_10');
  PERFORM check_and_award_achievement(user_id_param, 'whoami_50');

  RETURN QUERY
  SELECT a.code, CASE WHEN ua.id IS NOT NULL THEN true ELSE false END as awarded
  FROM achievements a
  LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = user_id_param
  ORDER BY a.points DESC, a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_all_achievements(UUID) TO authenticated;
