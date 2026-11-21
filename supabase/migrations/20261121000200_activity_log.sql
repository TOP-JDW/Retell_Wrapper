begin;

-- Who changed what, and when: client, branding, recordings, agent links, members and imports.
-- Rows can be added by owners and admins and read by them; nobody can change or delete a row through the app.
create table public.activity_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces,
  actor_id uuid not null default auth.uid(),
  actor_email text,
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text check (target_type in ('client', 'agent', 'member', 'retell')),
  target_id uuid,
  target_name text check (char_length(target_name) <= 200),
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 4000),
  created_at timestamptz not null default now()
);
create index activity_log_workspace_created on public.activity_log (workspace_id, created_at desc);
create index activity_log_target on public.activity_log (target_id) where target_id is not null;

-- The person and the time always come from the database, never from the app.
create function private.stamp_activity() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.actor_id := (select auth.uid());
  new.actor_email := (select u.email from auth.users u where u.id = new.actor_id);
  new.created_at := now();
  return new;
end $$;
revoke all on function private.stamp_activity() from public, anon, authenticated;
create trigger activity_log_stamp before insert on public.activity_log for each row execute function private.stamp_activity();

alter table public.activity_log enable row level security;
revoke all on public.activity_log from public, anon, authenticated;
grant select on public.activity_log to authenticated;
grant insert (workspace_id, action, target_type, target_id, target_name, details) on public.activity_log to authenticated;

create policy staff_read on public.activity_log for select to authenticated
  using ((select private.workspace_role(workspace_id)) in ('owner', 'admin'));
create policy staff_write on public.activity_log for insert to authenticated
  with check ((select private.workspace_role(workspace_id)) in ('owner', 'admin'));

commit;
