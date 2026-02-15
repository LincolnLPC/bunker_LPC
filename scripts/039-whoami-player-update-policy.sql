-- Allow players to update their own whoami words (mark as guessed)
CREATE POLICY "Player can update own whoami words" ON player_whoami_words FOR UPDATE USING (
  player_id IN (SELECT id FROM game_players WHERE user_id = auth.uid())
);
