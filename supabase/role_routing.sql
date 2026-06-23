-- Sprout — let the shared login detect a staff role from the entered email so it
-- can route staff to the officer/back-office app and customers to the app.
-- (Demo-level: exposes the staff email→role list to the public anon key.)
drop policy if exists "anon reads roles" on public.staff_roles;
create policy "anon reads roles" on public.staff_roles
  for select to anon using (true);
