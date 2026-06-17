-- Sprout — loan products catalogue (back office database)
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to re-run: it only creates things if they don't already exist.

-- 1) Table -------------------------------------------------------------------
create table if not exists public.products (
  id           bigint generated always as identity primary key,
  name         text not null,
  tag          text,                       -- small badge label, e.g. "Popular"
  tag_class    text not null default 'ghost', -- badge colour: lime | info | ghost | amber | ok
  description  text,                        -- one-line summary under the name
  stat1_label  text,
  stat1_value  text,
  stat2_label  text,
  stat2_value  text,
  featured     boolean not null default false, -- highlights the headline figure
  active       boolean not null default true,  -- show in the customer app?
  sort         int not null default 0,         -- display order (low = first)
  updated_at   timestamptz not null default now()
);

-- keep updated_at fresh on every change
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_products_touch on public.products;
create trigger trg_products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- 2) Row Level Security ------------------------------------------------------
alter table public.products enable row level security;

-- customers (anon) may read only active products
drop policy if exists "anon reads active products" on public.products;
create policy "anon reads active products" on public.products
  for select to anon using (active = true);

-- back-office staff (signed in) may read and write everything
drop policy if exists "staff read all" on public.products;
create policy "staff read all" on public.products
  for select to authenticated using (true);

drop policy if exists "staff write all" on public.products;
create policy "staff write all" on public.products
  for all to authenticated using (true) with check (true);

-- 3) Seed data (only if the table is empty) ----------------------------------
insert into public.products
  (name, tag, tag_class, description, stat1_label, stat1_value, stat2_label, stat2_value, featured, active, sort)
select * from (values
  ('Personal Loan',   'Popular',     'lime',  'Unsecured · ฿20k–฿2M · 6–60 mo',     'EIR from', '15.99%', 'Max term', '60 mo', true,  true, 1),
  ('Salaryman Quick', 'Fast',        'info',  'For payroll customers · ฿10k–฿300k', 'EIR from', '18.50%', 'Decision', '~1 day', false, true, 2),
  ('Nano / Micro',    'Reg. capped', 'ghost', 'Small ticket · ≤ ฿20,000',           'EIR cap',  '33%',    'Term',     '≤ 24 mo', false, true, 3)
) as v
where not exists (select 1 from public.products);
