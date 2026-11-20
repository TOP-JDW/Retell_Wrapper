begin;

-- What the read-only Retell import keeps. No phone numbers, transcripts or recordings are stored.
alter table public.agents
  add column is_suspended boolean not null default false,
  add column retell_modified_at timestamptz;
alter table public.calls
  add column call_status text,
  add column call_type text,
  add column direction text,
  add column disconnection_reason text,
  add column agent_version integer,
  add column duration_ms integer check (duration_ms >= 0);

-- Owners write the imported copy of their own workspace's agents and calls. Nobody else can, and nobody can delete.
-- Column grants stop the row id and the client link being changed through the application.
grant insert (workspace_id, name, retell_agent_id, is_suspended, retell_modified_at) on public.agents to authenticated;
grant update (workspace_id, name, retell_agent_id, is_suspended, retell_modified_at) on public.agents to authenticated;
grant insert (workspace_id, agent_id, retell_call_id, started_at, ended_at, call_status, call_type, direction, disconnection_reason, agent_version, duration_ms)
  on public.calls to authenticated;
grant update (workspace_id, agent_id, retell_call_id, started_at, ended_at, call_status, call_type, direction, disconnection_reason, agent_version, duration_ms)
  on public.calls to authenticated;

do $$
declare t text;
begin
  foreach t in array array['agents','calls'] loop
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (private.workspace_role(workspace_id) = ''owner'')', t);
    execute format('create policy owner_update on public.%I for update to authenticated using (private.workspace_role(workspace_id) = ''owner'') with check (private.workspace_role(workspace_id) = ''owner'')', t);
  end loop;
end $$;

commit;
