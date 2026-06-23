-- Sprout — Pre-screening rules (back office controlled)
-- Run once in Supabase: SQL Editor → paste → Run. Safe to re-run.

create table if not exists public.prescreen_rules (
  key        text primary key,          -- stable identifier used by the app
  label      text not null,             -- staff-facing label
  enabled    boolean not null default true,
  config     jsonb not null default '{}'::jsonb,  -- rule-specific settings
  sort       int not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_prescreen_touch on public.prescreen_rules;
create trigger trg_prescreen_touch before update on public.prescreen_rules
  for each row execute function public.touch_updated_at();

alter table public.prescreen_rules enable row level security;

drop policy if exists "anon reads rules" on public.prescreen_rules;
create policy "anon reads rules" on public.prescreen_rules
  for select to anon using (true);

drop policy if exists "staff read rules" on public.prescreen_rules;
create policy "staff read rules" on public.prescreen_rules
  for select to authenticated using (true);

drop policy if exists "staff write rules" on public.prescreen_rules;
create policy "staff write rules" on public.prescreen_rules
  for all to authenticated using (true) with check (true);

-- seed the default rule set (only if the table is empty)
insert into public.prescreen_rules (key, label, enabled, config, sort)
select * from (values
  ('age',          'Age within range',                         true,  '{"min":20,"max":60}'::jsonb,                                                                                                                                                                        1),
  ('gender',       'Allowed gender',                           true,  '{"allowed":["male","female"]}'::jsonb,                                                                                                                                                              2),
  ('occupation',   'Allowed occupations',                      true,  '{"allowed":["Engineer","Civil Engineer","Electrical Engineer","Software Developer","Teacher","Nurse","Doctor","Accountant","Sales Representative","Government Officer","Business Owner","Driver","Farmer","Police Officer"]}'::jsonb, 3),
  ('paytype',      'Allowed pay types',                        true,  '{"allowed":["Payroll","Self-employed","Business owner"]}'::jsonb,                                                                                                                                    4),
  ('documents',    'All required documents uploaded',          true,  '{}'::jsonb,                                                                                                                                                                                         5),
  ('fatca',        'FATCA / CRS — required answer',            true,  '{"allowed":["Yes"]}'::jsonb,                                                                                                                                                                        6),
  ('credit_score', 'Minimum credit bureau score',             true,  '{"min_score":600}'::jsonb,                                                                                                                                                                          7),
  ('income',       'Minimum monthly income (THB)',             false, '{"min_income":15000}'::jsonb,                                                                                                                                                                       8),
  ('dsr',          'Maximum debt service ratio (%)',           false, '{"max_dsr":70}'::jsonb,                                                                                                                                                                             9),
  ('nationality',  'Thai national / resident',                 false, '{}'::jsonb,                                                                                                                                                                                        10)
) as v(key,label,enabled,config,sort)
where not exists (select 1 from public.prescreen_rules);
