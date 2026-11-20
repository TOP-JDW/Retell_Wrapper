begin;

-- Transfer agents are helpers that sit behind another agent. They are kept, so call links stay correct,
-- but the application hides them by default.
alter table public.agents add column is_transfer_agent boolean not null default false;
grant insert (is_transfer_agent) on public.agents to authenticated;
grant update (is_transfer_agent) on public.agents to authenticated;

commit;
