-- Tables for "Кто Я?" game mode
-- player_whoami_words: words assigned to each player
-- whoami_word_votes: votes for "player guessed the word" when nextWordByVoting is enabled

CREATE TABLE IF NOT EXISTS player_whoami_words (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  word_index INTEGER NOT NULL,
  is_guessed BOOLEAN DEFAULT FALSE,
  guessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, word_index)
);

CREATE INDEX IF NOT EXISTS idx_player_whoami_words_player ON player_whoami_words(player_id);

-- Votes: when nextWordByVoting is on, other players confirm the target guessed the word
CREATE TABLE IF NOT EXISTS whoami_word_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  target_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  word_index INTEGER NOT NULL,
  voter_player_id UUID NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, target_player_id, word_index, voter_player_id)
);

CREATE INDEX IF NOT EXISTS idx_whoami_votes_lookup ON whoami_word_votes(room_id, target_player_id, word_index);

ALTER TABLE player_whoami_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoami_word_votes ENABLE ROW LEVEL SECURITY;

-- RLS: players can read words for players in their room
CREATE POLICY "Players can view whoami words in room" ON player_whoami_words FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM game_players gp
    JOIN game_rooms gr ON gr.id = gp.room_id
    WHERE gp.id = player_id
    AND (gr.host_id = auth.uid() OR EXISTS (SELECT 1 FROM game_players p2 WHERE p2.room_id = gr.id AND p2.user_id = auth.uid()))
  )
);

-- Host can insert/update whoami words (game start, next word)
CREATE POLICY "Host can manage whoami words" ON player_whoami_words FOR ALL USING (
  EXISTS (
    SELECT 1 FROM game_players gp
    JOIN game_rooms gr ON gr.id = gp.room_id
    WHERE gp.id = player_id AND gr.host_id = auth.uid()
  )
);

-- Players can read votes in their room
CREATE POLICY "Players can view whoami votes" ON whoami_word_votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM game_players WHERE room_id = whoami_word_votes.room_id AND user_id = auth.uid())
);

-- Players can insert their own vote
CREATE POLICY "Players can cast whoami vote" ON whoami_word_votes FOR INSERT WITH CHECK (
  voter_player_id IN (SELECT id FROM game_players WHERE user_id = auth.uid())
);
