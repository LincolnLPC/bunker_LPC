-- Create special_cards table for storing player's special action cards
CREATE TABLE IF NOT EXISTS special_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK (card_type IN ('exchange', 'peek', 'immunity', 'reroll', 'reveal', 'steal', 'discard-health', 'double-vote', 'no-vote-against', 'reshuffle', 'revote', 'replace-profession', 'replace-health')),
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  used_in_round INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create partial unique index to prevent duplicate unused cards of same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_special_cards_unique_unused 
ON special_cards(player_id, card_type) 
WHERE is_used = FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_special_cards_player_id ON special_cards(player_id);
CREATE INDEX IF NOT EXISTS idx_special_cards_room_id ON special_cards(room_id);
CREATE INDEX IF NOT EXISTS idx_special_cards_is_used ON special_cards(is_used);

-- Enable RLS
ALTER TABLE special_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Players can view their own cards
CREATE POLICY "Players can view own special cards" ON special_cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid())
);

-- Players can update their own cards (mark as used)
CREATE POLICY "Players can update own special cards" ON special_cards FOR UPDATE USING (
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid())
);

-- System can insert cards (via service role)
CREATE POLICY "Service role can insert special cards" ON special_cards FOR INSERT 
WITH CHECK (true);

-- Host can view all cards in their room
CREATE POLICY "Host can view all cards in room" ON special_cards FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM game_rooms gr 
    WHERE gr.id = room_id AND gr.host_id = auth.uid()
  )
);
