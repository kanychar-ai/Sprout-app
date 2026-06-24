-- Sprout — store customer document uploads so officers can view them.
-- Run once in Supabase: SQL Editor → paste → Run.

-- 1) public storage bucket for case documents -------------------------------
insert into storage.buckets (id, name, public)
values ('case-docs', 'case-docs', true)
on conflict (id) do update set public = true;

-- customer (anon) may upload files into the bucket
drop policy if exists "anon upload case docs" on storage.objects;
create policy "anon upload case docs" on storage.objects
  for insert to anon with check (bucket_id = 'case-docs');
-- (public bucket → files are readable via their public URL)

-- 2) document metadata (what was uploaded + officer's status) ----------------
create table if not exists public.case_documents (
  id        bigint generated always as identity primary key,
  case_id   text,
  doc_key   text,
  label     text,
  filename  text,
  path      text,
  status    text not null default 'review',   -- waiting | review | verified | re_request
  updated_at timestamptz not null default now(),
  unique (case_id, doc_key)
);
alter table public.case_documents enable row level security;

-- customer (anon) records / updates their own uploads
drop policy if exists "anon writes case docs" on public.case_documents;
create policy "anon writes case docs" on public.case_documents
  for all to anon using (true) with check (true);
-- officers (signed in) read all + set status
drop policy if exists "staff reads case docs" on public.case_documents;
create policy "staff reads case docs" on public.case_documents
  for select to authenticated using (true);
drop policy if exists "staff writes case docs" on public.case_documents;
create policy "staff writes case docs" on public.case_documents
  for all to authenticated using (true) with check (true);
