-- ============================================================
--  RISET-AI — setup awal Supabase (jalankan SEKALI di SQL Editor)
--  1) Bucket "uploads" untuk file docx/pdf/gambar
--  2) Policy: anon boleh upload & baca (mode single-user/testing)
--     Untuk produksi multi-user: ganti anon → authenticated + RLS.
-- ============================================================

-- bucket publik (URL file bisa diakses langsung oleh server saat parsing)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

-- anon boleh INSERT ke bucket uploads
create policy "riset_anon_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'uploads');

-- siapa pun boleh SELECT (baca) file di bucket uploads
create policy "riset_public_read" on storage.objects
  for select
  using (bucket_id = 'uploads');

-- (opsional) anon boleh UPDATE/menimpa — dipakai upsert saat re-upload nama sama
create policy "riset_anon_update" on storage.objects
  for update to anon
  using (bucket_id = 'uploads');
