begin;

-- 1. What each call cost in Retell, in US cents, as Retell reports it (call_cost.combined_cost). Filled by the import.
alter table public.calls add column cost_cents numeric(14, 4) check (cost_cents >= 0);
-- The import writes it, under the same owner-only policies as the other imported columns.
grant insert (cost_cents) on public.calls to authenticated;
grant update (cost_cents) on public.calls to authenticated;

-- 2. Usage per client for a period, for invoicing. Every call counts, transfer calls included, because they cost money.
-- Read-only, run as the caller, and only the caller's workspace.
create function public.call_usage(from_ts timestamptz, to_ts timestamptz)
returns table (client_id uuid, total integer, connected integer, duration_ms bigint, cost_cents numeric, costed integer)
language sql stable security invoker set search_path = ''
as $$
  select a.client_id,
         count(*)::integer,
         (count(*) filter (where c.call_status = 'ended'))::integer,
         coalesce(sum(c.duration_ms), 0)::bigint,
         coalesce(sum(c.cost_cents), 0),
         count(c.cost_cents)::integer
  from public.calls c
  join public.agents a on a.id = c.agent_id and a.workspace_id = c.workspace_id
  where c.started_at >= from_ts and c.started_at < to_ts
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
  group by 1
  order by 5 desc, 2 desc
$$;

-- 3. Calls by weekday (1 = Monday) and hour, in UK time, for the busy-hours chart.
create function public.call_hour_stats(from_ts timestamptz, to_ts timestamptz, include_transfers boolean default false)
returns table (weekday integer, hour integer, total integer)
language sql stable security invoker set search_path = ''
as $$
  select extract(isodow from c.started_at at time zone 'Europe/London')::integer,
         extract(hour from c.started_at at time zone 'Europe/London')::integer,
         count(*)::integer
  from public.calls c
  join public.agents a on a.id = c.agent_id and a.workspace_id = c.workspace_id
  where c.started_at >= from_ts and c.started_at < to_ts
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
    and (include_transfers or not a.is_transfer_agent)
  group by 1, 2
$$;

-- 4. Each agent's last call and recent errors, for health warnings. "at" is the moment to measure from (now by default).
create function public.agent_health(at timestamptz default now())
returns table (agent_id uuid, last_call_at timestamptz, calls_24h integer, errors_24h integer, calls_7d integer, errors_7d integer)
language sql stable security invoker set search_path = ''
as $$
  select c.agent_id,
         max(c.started_at),
         (count(*) filter (where c.started_at >= at - interval '24 hours'))::integer,
         (count(*) filter (where c.started_at >= at - interval '24 hours' and (c.call_status = 'error' or c.disconnection_reason like 'error%')))::integer,
         (count(*) filter (where c.started_at >= at - interval '7 days'))::integer,
         (count(*) filter (where c.started_at >= at - interval '7 days' and (c.call_status = 'error' or c.disconnection_reason like 'error%')))::integer
  from public.calls c
  where c.started_at <= at
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
  group by 1
$$;

revoke all on function public.call_usage(timestamptz, timestamptz) from public, anon;
revoke all on function public.call_hour_stats(timestamptz, timestamptz, boolean) from public, anon;
revoke all on function public.agent_health(timestamptz) from public, anon;
grant execute on function public.call_usage(timestamptz, timestamptz) to authenticated;
grant execute on function public.call_hour_stats(timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.agent_health(timestamptz) to authenticated;

commit;
