// SQL that creates the private file storage for document photos, receipts and
// profile/vehicle pictures, so files follow you to your other devices. Run once
// in Supabase → SQL Editor (safe to re-run). Same as the STORAGE part of
// supabase/schema.sql.
export const STORAGE_SQL = `-- The Assistant — file storage (documents, receipts, photos). Run once in Supabase → SQL Editor.

-- A private bucket; each household's files live under its own folder.
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

-- Only members of a household can read or write its folder.
drop policy if exists attach_member_read on storage.objects;
create policy attach_member_read on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments'
         and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists attach_member_write on storage.objects;
create policy attach_member_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments'
              and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists attach_member_update on storage.objects;
create policy attach_member_update on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments'
         and public.is_member(((storage.foldername(name))[1])::uuid));

drop policy if exists attach_member_delete on storage.objects;
create policy attach_member_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments'
         and public.is_member(((storage.foldername(name))[1])::uuid));`
