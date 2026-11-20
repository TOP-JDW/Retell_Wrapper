begin;

-- Read-only call statistics for the dashboard. They run as the caller, so row-level security applies,
-- and they only count the caller's own workspace. Days are UK calendar days.
-- "Connected" means Retell reports the call as ended; not connected, error and ongoing calls are not counted as connected.
create function public.call_daily_stats(from_ts timestamptz, to_ts timestamptz)
returns table (day date, total integer, connected integer, connected_ms bigint, timed integer)
language sql stable security invoker set search_path = ''
as $$
  select (c.started_at at time zone 'Europe/London')::date,
         count(*)::integer,
         (count(*) filter (where c.call_status = 'ended'))::integer,
         coalesce(sum(c.duration_ms) filter (where c.call_status = 'ended'), 0)::bigint,
         (count(c.duration_ms) filter (where c.call_status = 'ended'))::integer
  from public.calls c
  where c.started_at >= from_ts and c.started_at < to_ts
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
  group by 1
  order by 1
$$;

create function public.call_agent_stats(from_ts timestamptz, to_ts timestamptz)
returns table (agent_id uuid, total integer, connected integer, connected_ms bigint, timed integer)
language sql stable security invoker set search_path = ''
as $$
  select c.agent_id,
         count(*)::integer,
         (count(*) filter (where c.call_status = 'ended'))::integer,
         coalesce(sum(c.duration_ms) filter (where c.call_status = 'ended'), 0)::bigint,
         (count(c.duration_ms) filter (where c.call_status = 'ended'))::integer
  from public.calls c
  where c.started_at >= from_ts and c.started_at < to_ts
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
  group by 1
  order by 2 desc
$$;

revoke all on function public.call_daily_stats(timestamptz, timestamptz) from public, anon;
revoke all on function public.call_agent_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.call_daily_stats(timestamptz, timestamptz) to authenticated;
grant execute on function public.call_agent_stats(timestamptz, timestamptz) to authenticated;

-- Call History filters by date range and agent within a workspace.
create index if not exists calls_workspace_agent_started on public.calls (workspace_id, agent_id, started_at desc);

commit;
