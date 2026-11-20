begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0)
);
create table public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces,
  role text not null check (role in ('owner','admin','viewer'))
);
create index memberships_workspace on public.memberships(workspace_id);
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces,
  name text not null check (length(trim(name)) > 0),
  unique(workspace_id,id)
);
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces,
  client_id uuid,
  name text not null,
  retell_agent_id text,
  unique(workspace_id,id),
  unique(retell_agent_id),
  foreign key(workspace_id,client_id) references public.clients(workspace_id,id)
);
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces,
  agent_id uuid not null,
  retell_call_id text not null unique,
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at >= started_at),
  foreign key(workspace_id,agent_id) references public.agents(workspace_id,id)
);
create index calls_workspace_started on public.calls(workspace_id,started_at desc);
create table public.branding (
  workspace_id uuid primary key references public.workspaces,
  display_name text not null,
  accent_colour text not null default '#16584b' check (accent_colour ~ '^#[0-9a-fA-F]{6}$')
);

-- Read membership without recursive policies. Caller identity comes exclusively from Auth.
create function private.workspace_role(target uuid) returns text
language sql stable security definer set search_path = ''
as $$ select role from public.memberships where user_id = (select auth.uid()) and workspace_id = target $$;
revoke all on function private.workspace_role(uuid) from public, anon;
grant execute on function private.workspace_role(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['workspaces','memberships','clients','agents','calls','branding'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
  foreach t in array array['clients','agents','calls','branding'] loop
    execute format('create policy member_read on public.%I for select to authenticated using (private.workspace_role(workspace_id) is not null)',t);
  end loop;
  foreach t in array array['clients','branding'] loop
    execute format('grant insert, update on public.%I to authenticated',t);
    execute format('create policy staff_insert on public.%I for insert to authenticated with check (private.workspace_role(workspace_id) in (''owner'',''admin''))',t);
    execute format('create policy staff_update on public.%I for update to authenticated using (private.workspace_role(workspace_id) in (''owner'',''admin'')) with check (private.workspace_role(workspace_id) in (''owner'',''admin''))',t);
  end loop;
end $$;
create policy member_read on public.workspaces for select to authenticated using (private.workspace_role(id) is not null);
create policy member_directory on public.memberships for select to authenticated using (
  user_id = (select auth.uid()) or private.workspace_role(workspace_id) in ('owner','admin')
);
commit;
