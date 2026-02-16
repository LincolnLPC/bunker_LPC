-- Friends, private messages, and online status

-- Profiles: last activity and visibility of online status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_seen_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_seen_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'show_online_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN show_online_status BOOLEAN DEFAULT true;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at ON profiles (last_seen_at DESC NULLS LAST);

-- Friends: user_id is the one who has the friend, friend_id is the friend
-- status: 'pending' (request sent), 'accepted', 'blocked'
CREATE TABLE IF NOT EXISTS user_friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE user_friends ENABLE ROW LEVEL SECURITY;

-- Users can see their own friend rows (as user or as friend)
CREATE POLICY "Users can view own friends" ON user_friends FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "Users can insert own friend requests" ON user_friends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own friend rows" ON user_friends FOR UPDATE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "Users can delete own friend rows" ON user_friends FOR DELETE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

CREATE INDEX IF NOT EXISTS idx_user_friends_user_id ON user_friends (user_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_friend_id ON user_friends (friend_id);
CREATE INDEX IF NOT EXISTS idx_user_friends_status ON user_friends (status);

-- Private messages
CREATE TABLE IF NOT EXISTS private_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages" ON private_messages FOR SELECT USING (
  auth.uid() = from_user_id OR auth.uid() = to_user_id
);
CREATE POLICY "Users can insert own sent messages" ON private_messages FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Users can update own received messages (read_at)" ON private_messages FOR UPDATE USING (auth.uid() = to_user_id);

CREATE INDEX IF NOT EXISTS idx_private_messages_to_user_created ON private_messages (to_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_private_messages_from_user_created ON private_messages (from_user_id, created_at DESC);

-- Realtime for private_messages (optional, for live updates)
-- ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;
