begin;
-- Branding is owner-only. Admins keep managing clients.
drop policy staff_insert on public.branding;
drop policy staff_update on public.branding;
create policy owner_insert on public.branding for insert to authenticated
  with check (private.workspace_role(workspace_id) = 'owner');
create policy owner_update on public.branding for update to authenticated
  using (private.workspace_role(workspace_id) = 'owner')
  with check (private.workspace_role(workspace_id) = 'owner');

-- The member directory is owner-only. Everyone can still read their own membership.
drop policy member_directory on public.memberships;
create policy member_directory on public.memberships for select to authenticated using (
  user_id = (select auth.uid()) or private.workspace_role(workspace_id) = 'owner'
);
commit;
