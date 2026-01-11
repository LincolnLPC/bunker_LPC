-- Add media settings to profiles table

-- Add columns for media settings if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'media_settings'
  ) THEN
    ALTER TABLE profiles ADD COLUMN media_settings JSONB DEFAULT '{"autoRequestCamera": true, "autoRequestMicrophone": true, "defaultCameraEnabled": true, "defaultMicrophoneEnabled": true}';
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_profiles_media_settings ON profiles USING gin(media_settings);
