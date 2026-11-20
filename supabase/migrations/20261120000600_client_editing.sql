begin;

-- Client names: required, sensible length, and unique within a workspace whatever the capitals or spaces.
alter table public.clients add constraint clients_name_length check (length(trim(name)) between 1 and 120);
create unique index clients_workspace_name on public.clients (workspace_id, lower(trim(name)));

-- Owners and admins may delete a client. Its agents stay and become unlinked; their calls are untouched.
alter table public.agents drop constraint agents_workspace_id_client_id_fkey;
alter table public.agents add constraint agents_workspace_id_client_id_fkey
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete set null (client_id);
create index agents_workspace_client_lookup on public.agents (client_id) where client_id is not null;

grant delete on public.clients to authenticated;
create policy staff_delete on public.clients for delete to authenticated
  using (private.workspace_role(workspace_id) in ('owner', 'admin'));

-- Owners and admins link an agent to a client, or unlink it. This is the only change admins can make to an agent,
-- so it goes through one checked function instead of opening agent updates to admins.
create function public.set_agent_client(target_agent uuid, target_client uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare ws uuid;
begin
  select workspace_id into ws from public.agents where id = target_agent;
  if ws is null or coalesce(private.workspace_role(ws), '') not in ('owner', 'admin') then
    raise exception 'Agent not found.' using errcode = '42501';
  end if;
  if target_client is not null and not exists (select 1 from public.clients where id = target_client and workspace_id = ws) then
    raise exception 'Client not found.' using errcode = '42501';
  end if;
  update public.agents set client_id = target_client where id = target_agent;
end $$;
revoke all on function public.set_agent_client(uuid, uuid) from public, anon;
grant execute on function public.set_agent_client(uuid, uuid) to authenticated;

commit;
