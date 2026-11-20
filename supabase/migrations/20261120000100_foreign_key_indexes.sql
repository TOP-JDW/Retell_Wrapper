-- Index the composite foreign keys so joins and cascading checks do not scan whole tables.
create index if not exists calls_workspace_agent on public.calls(workspace_id, agent_id);
create index if not exists agents_workspace_client on public.agents(workspace_id, client_id);
