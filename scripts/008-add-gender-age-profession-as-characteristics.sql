-- Add gender, age, profession as hidden characteristics for existing players
-- This script converts existing player attributes to characteristics

-- Update the category constraint to allow new categories
ALTER TABLE player_characteristics DROP CONSTRAINT IF EXISTS player_characteristics_category_check;
ALTER TABLE player_characteristics ADD CONSTRAINT player_characteristics_category_check 
  CHECK (category IN ('gender', 'age', 'profession', 'health', 'hobby', 'phobia', 'baggage', 'fact', 'special', 'bio', 'skill', 'trait', 'additional'));

-- Function to add gender, age, profession as characteristics for a player
-- Note: This should be run for new players going forward via the API
-- For existing players, this can be run manually if needed

-- Example query to add these characteristics for existing players (run if needed):
/*
DO $$
DECLARE
  player_record RECORD;
  gender_char_id UUID;
  age_char_id UUID;
  profession_char_id UUID;
BEGIN
  FOR player_record IN SELECT id, gender, gender_modifier, age, profession FROM game_players LOOP
    -- Check if characteristics already exist
    SELECT id INTO gender_char_id FROM player_characteristics 
    WHERE player_id = player_record.id AND category = 'gender';
    
    SELECT id INTO age_char_id FROM player_characteristics 
    WHERE player_id = player_record.id AND category = 'age';
    
    SELECT id INTO profession_char_id FROM player_characteristics 
    WHERE player_id = player_record.id AND category = 'profession';
    
    -- Insert gender if doesn't exist
    IF gender_char_id IS NULL THEN
      INSERT INTO player_characteristics (player_id, category, name, value, is_revealed, sort_order)
      VALUES (
        player_record.id,
        'gender',
        'Пол',
        player_record.gender || COALESCE(player_record.gender_modifier, ''),
        FALSE,
        0
      );
    END IF;
    
    -- Insert age if doesn't exist
    IF age_char_id IS NULL THEN
      INSERT INTO player_characteristics (player_id, category, name, value, is_revealed, sort_order)
      VALUES (
        player_record.id,
        'age',
        'Возраст',
        player_record.age::TEXT || ' лет',
        FALSE,
        1
      );
    END IF;
    
    -- Insert profession if doesn't exist
    IF profession_char_id IS NULL THEN
      INSERT INTO player_characteristics (player_id, category, name, value, is_revealed, sort_order)
      VALUES (
        player_record.id,
        'profession',
        'Профессия',
        player_record.profession,
        FALSE,
        2
      );
    END IF;
  END LOOP;
END $$;
*/
