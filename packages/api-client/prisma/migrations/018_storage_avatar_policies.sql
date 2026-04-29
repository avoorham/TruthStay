-- Allow authenticated users to upload/update their own avatar
-- Avatars are stored as <user_id>.jpg in the avatars bucket

CREATE POLICY "avatars_user_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND name = auth.uid()::text || '.jpg'
  );

CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND name = auth.uid()::text || '.jpg'
  );
