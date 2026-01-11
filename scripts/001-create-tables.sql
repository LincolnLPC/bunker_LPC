-- Bunker Online Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users/Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'premium')),
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Game rooms table
CREATE TABLE game_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_code TEXT UNIQUE NOT NULL,
  host_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  max_players INTEGER DEFAULT 12 CHECK (max_players IN (8, 12, 16, 20)),
  catastrophe TEXT NOT NULL,
  bunker_description TEXT NOT NULL,
  phase TEXT DEFAULT 'waiting' CHECK (phase IN ('waiting', 'playing', 'voting', 'results', 'finished')),
  current_round INTEGER DEFAULT 0,
  round_timer_seconds INTEGER DEFAULT 120,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on game_rooms
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view game rooms" ON game_rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rooms" ON game_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Host can update room" ON game_rooms FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Host can delete room" ON game_rooms FOR DELETE USING (auth.uid() = host_id);

-- Players in game table
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('М', 'Ж', 'А')),
  gender_modifier TEXT DEFAULT '' CHECK (gender_modifier IN ('', '(с)', '(а)')),
  age INTEGER NOT NULL CHECK (age >= 0 AND age <= 120),
  profession TEXT NOT NULL,
  is_eliminated BOOLEAN DEFAULT FALSE,
  is_host BOOLEAN DEFAULT FALSE,
  video_enabled BOOLEAN DEFAULT TRUE,
  audio_enabled BOOLEAN DEFAULT TRUE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, slot),
  UNIQUE(room_id, user_id)
);

-- Enable RLS on game_players
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view players in rooms" ON game_players FOR SELECT USING (true);
CREATE POLICY "Users can join rooms" ON game_players FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own player" ON game_players FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Host can update any player" ON game_players FOR UPDATE USING (
  EXISTS (SELECT 1 FROM game_rooms WHERE id = room_id AND host_id = auth.uid())
);
CREATE POLICY "Users can leave rooms" ON game_players FOR DELETE USING (auth.uid() = user_id);

-- Player characteristics table
CREATE TABLE player_characteristics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES game_players(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('gender', 'age', 'profession', 'health', 'hobby', 'phobia', 'baggage', 'fact', 'special', 'bio', 'skill', 'trait', 'additional')),
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  is_revealed BOOLEAN DEFAULT FALSE,
  reveal_round INTEGER,
  sort_order INTEGER DEFAULT 0
);

-- Enable RLS on characteristics
ALTER TABLE player_characteristics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view revealed characteristics" ON player_characteristics FOR SELECT USING (
  is_revealed = TRUE OR 
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM game_players gp JOIN game_rooms gr ON gp.room_id = gr.id WHERE gp.id = player_id AND gr.host_id = auth.uid())
);
CREATE POLICY "Players can update own characteristics" ON player_characteristics FOR UPDATE USING (
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid())
);
CREATE POLICY "Host can update any characteristics" ON player_characteristics FOR UPDATE USING (
  EXISTS (SELECT 1 FROM game_players gp JOIN game_rooms gr ON gp.room_id = gr.id WHERE gp.id = player_id AND gr.host_id = auth.uid())
);

-- Votes table
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  voter_id UUID REFERENCES game_players(id) ON DELETE CASCADE,
  target_id UUID REFERENCES game_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, round, voter_id)
);

-- Enable RLS on votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can view votes after round ends" ON votes FOR SELECT USING (
  EXISTS (SELECT 1 FROM game_rooms WHERE id = room_id AND phase IN ('results', 'finished'))
);
CREATE POLICY "Players can cast votes" ON votes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM game_players WHERE id = voter_id AND user_id = auth.uid())
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES game_rooms(id) ON DELETE CASCADE,
  player_id UUID REFERENCES game_players(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat' CHECK (message_type IN ('chat', 'system', 'vote', 'reveal')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone in room can view messages" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "Players can send messages" ON chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM game_players WHERE id = player_id AND user_id = auth.uid())
);

-- Indexes for performance
CREATE INDEX idx_game_rooms_code ON game_rooms(room_code);
CREATE INDEX idx_game_rooms_phase ON game_rooms(phase);
CREATE INDEX idx_game_players_room ON game_players(room_id);
CREATE INDEX idx_game_players_user ON game_players(user_id);
CREATE INDEX idx_characteristics_player ON player_characteristics(player_id);
CREATE INDEX idx_votes_room_round ON votes(room_id, round);
CREATE INDEX idx_chat_room ON chat_messages(room_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER game_rooms_updated_at BEFORE UPDATE ON game_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
