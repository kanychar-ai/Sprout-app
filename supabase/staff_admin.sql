-- Sprout — let the back office manage staff role assignments (email → role/tier).
-- Run after staff.sql. (Demo-level: any signed-in staff can edit roles; a production
-- build would restrict writes to admins via a role check.)
drop policy if exists "staff write roles" on public.staff_roles;
create policy "staff write roles" on public.staff_roles
  for all to authenticated using (true) with check (true);
