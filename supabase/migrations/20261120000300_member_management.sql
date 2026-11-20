begin;

-- Show who each member is. The address is copied from Auth by a trigger, so an application user can never set it.
alter table public.memberships add column email text;
update public.memberships m set email = u.email from auth.users u where u.id = m.user_id;

create function private.set_member_email() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.email := (select email from auth.users where id = new.user_id);
  return new;
end $$;
revoke all on function private.set_member_email() from public, anon, authenticated;
create trigger memberships_set_email before insert on public.memberships
  for each row execute function private.set_member_email();

-- A workspace must always keep an owner, whatever the application does.
-- The workspace row is locked first so two owners cannot remove each other at the same moment.
create function private.keep_an_owner() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    perform 1 from public.workspaces where id = old.workspace_id for update;
    if not exists (
      select 1 from public.memberships
      where workspace_id = old.workspace_id and role = 'owner' and user_id <> old.user_id
    ) then
      raise exception 'A workspace must keep at least one owner.';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.keep_an_owner() from public, anon, authenticated;
create trigger memberships_keep_an_owner before update or delete on public.memberships
  for each row execute function private.keep_an_owner();

-- Owners manage members of their own workspace. Only the role can change; the person and workspace never can.
grant insert (user_id, workspace_id, role) on public.memberships to authenticated;
grant update (role) on public.memberships to authenticated;
grant delete on public.memberships to authenticated;

create policy owner_insert on public.memberships for insert to authenticated
  with check (private.workspace_role(workspace_id) = 'owner');
create policy owner_update on public.memberships for update to authenticated
  using (private.workspace_role(workspace_id) = 'owner')
  with check (private.workspace_role(workspace_id) = 'owner');
create policy owner_delete on public.memberships for delete to authenticated
  using (private.workspace_role(workspace_id) = 'owner');

commit;
