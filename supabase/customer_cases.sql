-- Sprout — let the CUSTOMER app create its application case and read its own status.
-- Run after staff.sql. (Demo-level access for the public anon key.)

-- customer submits an application → inserts a case (status to_review)
drop policy if exists "anon creates case" on public.cases;
create policy "anon creates case" on public.cases
  for insert to anon with check (status = 'to_review');

-- customer reads the case status back (by the id stored on their device)
-- NOTE: demo-level — a production build would scope this to the signed-in customer.
drop policy if exists "anon reads case" on public.cases;
create policy "anon reads case" on public.cases
  for select to anon using (true);
