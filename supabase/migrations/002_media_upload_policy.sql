-- Run after 001_messenger.sql. Fixes "new row violates row-level security policy" on chat uploads.
-- Supabase Storage checks the insert policy before it records the file's metadata, so the old
-- size checks always saw an empty size. Size and type limits are still enforced by the bucket
-- settings, and per kind by send_message and manage_group once the upload has finished.
begin;

drop policy media_upload on storage.objects;
create policy media_upload on storage.objects for insert to authenticated with check(
  bucket_id='chat-media' and (storage.foldername(name))[2]=auth.uid()::text
  and public.can_send((storage.foldername(name))[1]::uuid));

commit;
