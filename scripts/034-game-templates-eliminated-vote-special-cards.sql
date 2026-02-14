-- Add eliminated_can_vote and special_cards_per_player to game_templates
ALTER TABLE game_templates
  ADD COLUMN IF NOT EXISTS eliminated_can_vote BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS special_cards_per_player INTEGER DEFAULT 1 CHECK (special_cards_per_player >= 1 AND special_cards_per_player <= 30);
