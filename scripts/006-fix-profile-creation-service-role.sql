-- Alternative: Allow service role to bypass RLS for profile creation
-- This is used by the trigger function which runs as SECURITY DEFINER

-- The trigger function already uses SECURITY DEFINER, so it should work
-- But if there are still issues, we can create a helper function that the API can call

-- Create a function that can be called from API to create profile
-- This function runs with elevated privileges (SECURITY DEFINER) and can bypass RLS
CREATE OR REPLACE FUNCTION public.create_user_profile(user_uuid UUID, user_email TEXT DEFAULT NULL, user_meta JSONB DEFAULT '{}'::jsonb)
RETURNS TABLE (
  id UUID,
  username TEXT,
  display_name TEXT,
  subscription_tier TEXT
) AS $$
DECLARE
  generated_username TEXT;
  clean_username TEXT;
  counter INTEGER := 0;
BEGIN
  -- Generate base username
  generated_username := COALESCE(
    user_meta->>'username',
    CASE 
      WHEN user_email IS NOT NULL THEN split_part(user_email, '@', 1)
      ELSE 'user_' || substr(user_uuid::text, 1, 8)
    END
  );
  
  -- Clean username: remove special characters, limit length
  clean_username := regexp_replace(generated_username, '[^a-zA-Z0-9_]', '', 'g');
  clean_username := substring(clean_username FROM 1 FOR 20);
  
  -- Ensure username is not empty
  IF clean_username = '' OR clean_username IS NULL THEN
    clean_username := 'user_' || substr(user_uuid::text, 1, 8);
  END IF;
  
  generated_username := clean_username;
  
  -- Ensure username is unique (try up to 10 times)
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = generated_username) AND counter < 10 LOOP
    generated_username := clean_username || '_' || floor(random() * 100000)::text;
    counter := counter + 1;
  END LOOP;
  
  -- Insert or update profile
  INSERT INTO profiles (id, username, display_name, subscription_tier, media_settings)
  VALUES (
    user_uuid,
    generated_username,
    COALESCE(user_meta->>'display_name', user_meta->>'username', generated_username),
    'basic',
    '{"autoRequestCamera": true, "autoRequestMicrophone": true, "defaultCameraEnabled": true, "defaultMicrophoneEnabled": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(profiles.username, EXCLUDED.username) -- Keep existing username if conflict
  RETURNING profiles.id, profiles.username, profiles.display_name, profiles.subscription_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;
