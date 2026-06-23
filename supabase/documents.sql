-- Sprout — Document requirements (back office controlled)
-- Run once in Supabase: SQL Editor → paste → Run. Safe to re-run.

create table if not exists public.doc_requirements (
  id          bigint generated always as identity primary key,
  key         text unique not null,           -- stable id used by the app
  label       text not null,
  description text,
  icon        text not null default '📄',
  requirement text not null default 'required', -- 'required' | 'optional'
  source      text not null default 'upload',   -- 'upload' (customer uploads) | 'kyc' (auto from e-KYC)
  active      boolean not null default true,    -- show in the app?
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_docreq_touch on public.doc_requirements;
create trigger trg_docreq_touch before update on public.doc_requirements
  for each row execute function public.touch_updated_at();

alter table public.doc_requirements enable row level security;

drop policy if exists "anon reads active docs" on public.doc_requirements;
create policy "anon reads active docs" on public.doc_requirements
  for select to anon using (active = true);

drop policy if exists "staff read docs" on public.doc_requirements;
create policy "staff read docs" on public.doc_requirements
  for select to authenticated using (true);

drop policy if exists "staff write docs" on public.doc_requirements;
create policy "staff write docs" on public.doc_requirements
  for all to authenticated using (true) with check (true);

insert into public.doc_requirements (key, label, description, icon, requirement, source, active, sort)
select * from (values
  ('id',        'National ID card', 'Added from your KYC scan',   '🪪', 'required', 'kyc',    true, 1),
  ('payslip',   'Payslip',          'Most recent month',          '📄', 'required', 'upload', true, 2),
  ('statement', 'Bank statement',   'Last 3 months',              '📄', 'required', 'upload', true, 3),
  ('passbook',  'Book bank',        'Passbook cover · name page', '📑', 'required', 'upload', true, 4),
  ('address',   'Proof of address', 'Utility bill or lease',      '🏠', 'optional', 'upload', true, 5)
) as v(key,label,description,icon,requirement,source,active,sort)
where not exists (select 1 from public.doc_requirements);
