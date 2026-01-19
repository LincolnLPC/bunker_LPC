-- Achievement system for tracking user accomplishments
-- This script creates tables for achievements and user achievements

-- Achievements table - defines all possible achievements
CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- Unique code for achievement (e.g., 'first_game', 'win_streak_5')
  name TEXT NOT NULL, -- Display name (e.g., 'Первая игра')
  description TEXT NOT NULL, -- Description (e.g., 'Сыграйте первую игру')
  icon TEXT DEFAULT 'trophy', -- Icon name from lucide-react (trophy, medal, star, etc.)
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'games', 'wins', 'social', 'premium', 'special')),
  requirement_value INTEGER DEFAULT 1, -- Target value (e.g., 5 for 'win_streak_5')
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  points INTEGER DEFAULT 10, -- Points awarded for achievement
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User achievements table - tracks which achievements users have earned
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  progress INTEGER DEFAULT 100, -- Progress percentage (100 = completed)
  UNIQUE(user_id, achievement_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- Enable RLS
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for achievements (anyone can view achievements)
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (true);

-- RLS Policies for user_achievements (users can view own achievements)
CREATE POLICY "Users can view own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Initial achievements data
INSERT INTO achievements (code, name, description, icon, category, requirement_value, tier, points) VALUES
  -- General achievements
  ('first_game', 'Первая игра', 'Сыграйте первую игру', 'play-circle', 'general', 1, 'bronze', 10),
  ('games_10', 'Опытный игрок', 'Сыграйте 10 игр', 'users', 'games', 10, 'bronze', 50),
  ('games_50', 'Ветеран', 'Сыграйте 50 игр', 'award', 'games', 50, 'silver', 200),
  ('games_100', 'Легенда', 'Сыграйте 100 игр', 'crown', 'games', 100, 'gold', 500),
  ('games_500', 'Мастер', 'Сыграйте 500 игр', 'trophy', 'games', 500, 'platinum', 2000),
  
  -- Win achievements
  ('first_win', 'Первая победа', 'Выиграйте первую игру', 'trophy', 'wins', 1, 'bronze', 25),
  ('wins_5', 'Победитель', 'Выиграйте 5 игр', 'medal', 'wins', 5, 'bronze', 100),
  ('wins_25', 'Чемпион', 'Выиграйте 25 игр', 'award', 'wins', 25, 'silver', 400),
  ('wins_100', 'Непобедимый', 'Выиграйте 100 игр', 'crown', 'wins', 100, 'gold', 1500),
  
  -- Win rate achievements
  ('win_rate_50', 'Стабильный победитель', 'Имейте 50%+ победы при минимум 10 играх', 'target', 'wins', 50, 'silver', 300),
  ('win_rate_75', 'Мастер тактики', 'Имейте 75%+ победы при минимум 20 играх', 'zap', 'wins', 75, 'gold', 800),
  
  -- Social achievements
  ('host_10', 'Принимающий', 'Создайте 10 комнат', 'settings', 'social', 10, 'bronze', 100),
  ('host_50', 'Организатор', 'Создайте 50 комнат', 'user-plus', 'social', 50, 'silver', 500),
  
  -- Premium achievements
  ('premium_subscriber', 'Премиум игрок', 'Активируйте премиум подписку', 'crown', 'premium', 1, 'gold', 1000),
  
  -- Special achievements
  ('perfect_game', 'Идеальная игра', 'Выиграйте игру без единого голоса против вас', 'star', 'special', 1, 'platinum', 2000),
  ('survivor', 'Выживший', 'Выживите в игре с 20 игроками', 'shield', 'special', 20, 'gold', 1500),
  ('last_stand', 'Последний рубеж', 'Выиграйте игру будучи последним выжившим', 'flame', 'special', 1, 'platinum', 2500)
ON CONFLICT (code) DO NOTHING;

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_and_award_achievement(
  user_id_param UUID,
  achievement_code_param TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  achievement_record RECORD;
  user_stats RECORD;
  should_award BOOLEAN := false;
  progress_value INTEGER := 0;
BEGIN
  -- Get achievement details
  SELECT * INTO achievement_record
  FROM achievements
  WHERE code = achievement_code_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if user already has this achievement
  IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = user_id_param AND achievement_id = achievement_record.id) THEN
    RETURN false;
  END IF;

  -- Get user stats
  SELECT games_played, games_won INTO user_stats
  FROM profiles
  WHERE id = user_id_param;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check achievement requirements based on code
  CASE achievement_code_param
    WHEN 'first_game' THEN
      should_award := user_stats.games_played >= 1;
      progress_value := LEAST(100, (user_stats.games_played / 1) * 100);
      
    WHEN 'games_10' THEN
      should_award := user_stats.games_played >= 10;
      progress_value := LEAST(100, (user_stats.games_played / 10) * 100);
      
    WHEN 'games_50' THEN
      should_award := user_stats.games_played >= 50;
      progress_value := LEAST(100, (user_stats.games_played / 50) * 100);
      
    WHEN 'games_100' THEN
      should_award := user_stats.games_played >= 100;
      progress_value := LEAST(100, (user_stats.games_played / 100) * 100);
      
    WHEN 'games_500' THEN
      should_award := user_stats.games_played >= 500;
      progress_value := LEAST(100, (user_stats.games_played / 500) * 100);
      
    WHEN 'first_win' THEN
      should_award := user_stats.games_won >= 1;
      progress_value := LEAST(100, (user_stats.games_won / 1) * 100);
      
    WHEN 'wins_5' THEN
      should_award := user_stats.games_won >= 5;
      progress_value := LEAST(100, (user_stats.games_won / 5) * 100);
      
    WHEN 'wins_25' THEN
      should_award := user_stats.games_won >= 25;
      progress_value := LEAST(100, (user_stats.games_won / 25) * 100);
      
    WHEN 'wins_100' THEN
      should_award := user_stats.games_won >= 100;
      progress_value := LEAST(100, (user_stats.games_won / 100) * 100);
      
    WHEN 'win_rate_50' THEN
      IF user_stats.games_played >= 10 THEN
        should_award := (user_stats.games_won::FLOAT / NULLIF(user_stats.games_played, 0) * 100) >= 50;
        progress_value := LEAST(100, ((user_stats.games_won::FLOAT / NULLIF(user_stats.games_played, 0) * 100) / 50) * 100);
      END IF;
      
    WHEN 'win_rate_75' THEN
      IF user_stats.games_played >= 20 THEN
        should_award := (user_stats.games_won::FLOAT / NULLIF(user_stats.games_played, 0) * 100) >= 75;
        progress_value := LEAST(100, ((user_stats.games_won::FLOAT / NULLIF(user_stats.games_played, 0) * 100) / 75) * 100);
      END IF;
      
    ELSE
      -- For achievements that require special logic (premium, perfect_game, etc.)
      -- These will be checked separately in application code
      RETURN false;
  END CASE;

  -- Award achievement if requirement met
  IF should_award THEN
    INSERT INTO user_achievements (user_id, achievement_id, progress)
    VALUES (user_id_param, achievement_record.id, 100)
    ON CONFLICT (user_id, achievement_id) DO NOTHING;
    
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_and_award_achievement(UUID, TEXT) TO authenticated;

-- Function to check all achievements for a user (call after stats update)
CREATE OR REPLACE FUNCTION check_all_achievements(user_id_param UUID)
RETURNS TABLE(achievement_code TEXT, awarded BOOLEAN) AS $$
BEGIN
  -- Check general game achievements
  PERFORM check_and_award_achievement(user_id_param, 'first_game');
  PERFORM check_and_award_achievement(user_id_param, 'games_10');
  PERFORM check_and_award_achievement(user_id_param, 'games_50');
  PERFORM check_and_award_achievement(user_id_param, 'games_100');
  PERFORM check_and_award_achievement(user_id_param, 'games_500');
  
  -- Check win achievements
  PERFORM check_and_award_achievement(user_id_param, 'first_win');
  PERFORM check_and_award_achievement(user_id_param, 'wins_5');
  PERFORM check_and_award_achievement(user_id_param, 'wins_25');
  PERFORM check_and_award_achievement(user_id_param, 'wins_100');
  
  -- Check win rate achievements
  PERFORM check_and_award_achievement(user_id_param, 'win_rate_50');
  PERFORM check_and_award_achievement(user_id_param, 'win_rate_75');
  
  RETURN QUERY
  SELECT a.code, CASE WHEN ua.id IS NOT NULL THEN true ELSE false END as awarded
  FROM achievements a
  LEFT JOIN user_achievements ua ON ua.achievement_id = a.id AND ua.user_id = user_id_param
  ORDER BY a.points DESC, a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_all_achievements(UUID) TO authenticated;
