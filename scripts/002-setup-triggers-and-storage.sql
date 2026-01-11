-- Setup triggers and storage for Bunker Online

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, subscription_tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    'basic'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Note: Storage bucket must be created manually in Supabase Dashboard:
-- 1. Go to Storage in Supabase Dashboard
-- 2. Create a new bucket named "avatars"
-- 3. Set it as public bucket
-- 4. Add policy:
--    CREATE POLICY "Public Avatar Access"
--    ON storage.objects FOR SELECT
--    USING (bucket_id = 'avatars');
--
--    CREATE POLICY "Users can upload own avatars"
--    ON storage.objects FOR INSERT
--    WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
--
--    CREATE POLICY "Users can update own avatars"
--    ON storage.objects FOR UPDATE
--    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
--
--    CREATE POLICY "Users can delete own avatars"
--    ON storage.objects FOR DELETE
--    USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
