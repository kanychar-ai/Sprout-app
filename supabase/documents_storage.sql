-- Sprout — store customer document uploads so officers can view them.
-- Run once in Supabase: SQL Editor → paste → Run.

-- 1) public storage bucket for case documents -------------------------------
insert into storage.buckets (id, name, public)
values ('case-docs', 'case-docs', true)
on conflict (id) do update set public = true;

-- Allow uploads into the case-docs bucket.
-- NOTE: the Storage API executes the object write under the `authenticated`
-- Postgres role context (not `anon`), so a policy scoped `to anon` rejects
-- customer uploads with "new row violates row-level security policy" (HTTP 400).
-- Scope these `to public` so the upload succeeds regardless of the role the
-- Storage service uses. (The bucket is public, so reads are already open via the
-- public URL; the select policy keeps API listing working too.)
drop policy if exists "anon upload case docs" on storage.objects;
drop policy if exists "case-docs insert" on storage.objects;
drop policy if exists "case-docs update" on storage.objects;
drop policy if exists "case-docs select" on storage.objects;
create policy "case-docs insert" on storage.objects
  for insert to public with check (bucket_id = 'case-docs');
create policy "case-docs update" on storage.objects
  for update to public using (bucket_id = 'case-docs') with check (bucket_id = 'case-docs');
create policy "case-docs select" on storage.objects
  for select to public using (bucket_id = 'case-docs');

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
