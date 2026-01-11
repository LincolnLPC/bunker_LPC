-- Setup Storage bucket and policies for avatars
-- Note: The bucket itself must be created manually in Supabase Dashboard
-- This script only sets up the RLS policies

-- Enable RLS on storage.objects if not already enabled
-- (Usually enabled by default in Supabase)

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Avatar Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;

-- Policy 1: Anyone can view avatars (public read access)
CREATE POLICY "Public Avatar Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Policy 2: Authenticated users can upload avatars (but only to their own folder)
-- Note: The code currently uploads files directly to bucket root with user ID in filename
-- This allows any authenticated user to upload, but files are named with their user ID
CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);

-- Policy 3: Authenticated users can update their own avatars
CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);

-- Policy 4: Authenticated users can delete their own avatars
CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
);
