-- Sprout — Officer (staff) side: cases, audit log, and staff roles.
-- Run once in Supabase: SQL Editor → paste → Run. Safe to re-run.

-- 1) staff roles (who is a reviewer / approver) --------------------------------
create table if not exists public.staff_roles (
  email text primary key,
  name  text,
  role  text not null check (role in ('officer','manager'))
);
alter table public.staff_roles enable row level security;
drop policy if exists "staff read roles" on public.staff_roles;
create policy "staff read roles" on public.staff_roles for select to authenticated using (true);
-- (insert/update staff roles from the SQL editor / dashboard)

-- 2) loan cases ----------------------------------------------------------------
create table if not exists public.cases (
  id            text primary key,                 -- e.g. SV0234
  customer_name text not null,
  product       text, amount numeric, term int, monthly numeric, purpose text,
  occupation    text, employer text, income numeric, existing_debt numeric,
  phone         text, national_id text,
  score         int,  dsr int, ncb text,
  status        text not null default 'to_review',
                -- to_review | awaiting_docs | pending_approval | approved | rejected | disbursed
  recommendation  text,        -- approve | decline (the reviewer/maker's recommendation)
  reviewer_email  text, reviewer_name text, reviewer_note text, reviewed_at timestamptz,
  approver_email  text, approver_name text, decision_reason text, decided_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_cases_touch on public.cases;
create trigger trg_cases_touch before update on public.cases
  for each row execute function public.touch_updated_at();

alter table public.cases enable row level security;
drop policy if exists "staff read cases" on public.cases;
create policy "staff read cases" on public.cases for select to authenticated using (true);
drop policy if exists "staff write cases" on public.cases;
create policy "staff write cases" on public.cases for all to authenticated using (true) with check (true);

-- 3) audit log (who / when / what) --------------------------------------------
create table if not exists public.case_events (
  id        bigint generated always as identity primary key,
  case_id   text references public.cases(id) on delete cascade,
  actor_email text, actor_name text,
  action    text not null,   -- reviewed | requested_docs | approved | rejected | disbursed | status
  detail    text,
  at        timestamptz not null default now()
);
alter table public.case_events enable row level security;
drop policy if exists "staff read events" on public.case_events;
create policy "staff read events" on public.case_events for select to authenticated using (true);
drop policy if exists "staff write events" on public.case_events;
create policy "staff write events" on public.case_events for insert to authenticated with check (true);

-- 4) seed demo cases (only if empty) ------------------------------------------
insert into public.cases (id,customer_name,product,amount,term,monthly,purpose,occupation,employer,income,existing_debt,phone,national_id,score,dsr,ncb,status)
select * from (values
  ('SV0234','Mintra Jaidee','Starter Cash',30000,12,2650,'Home repair','Marketer','ACME Co., Ltd.',35000,2150,'081-234-5678','1-1037-xxxxx-12-3',72,28,'clear','to_review'),
  ('SV0231','Thana Suk','Flex Line',80000,24,4100,'Working capital','Engineer','SCG',55000,9000,'089-111-2222','1-2002-xxxxx-44-1',66,41,'clear','to_review'),
  ('SV0228','Meen Shop','Stock Boost',50000,18,3200,'Inventory','Business owner','Meen Shop',60000,12000,'082-333-4444','1-3003-xxxxx-55-2',61,38,'1 late','to_review')
) as v(id,customer_name,product,amount,term,monthly,purpose,occupation,employer,income,existing_debt,phone,national_id,score,dsr,ncb,status)
where not exists (select 1 from public.cases);
