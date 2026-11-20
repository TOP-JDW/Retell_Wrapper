begin;

-- One agent's calls per UK day, for agent pages. Read-only, runs as the caller, and counts only their workspace.
create function public.call_agent_daily_stats(target_agent uuid, from_ts timestamptz, to_ts timestamptz)
returns table (day date, total integer, connected integer, connected_ms bigint, timed integer)
language sql stable security invoker set search_path = ''
as $$
  select (c.started_at at time zone 'Europe/London')::date,
         count(*)::integer,
         (count(*) filter (where c.call_status = 'ended'))::integer,
         coalesce(sum(c.duration_ms) filter (where c.call_status = 'ended'), 0)::bigint,
         (count(c.duration_ms) filter (where c.call_status = 'ended'))::integer
  from public.calls c
  where c.agent_id = target_agent
    and c.started_at >= from_ts and c.started_at < to_ts
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
  group by 1
  order by 1
$$;
revoke all on function public.call_agent_daily_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.call_agent_daily_stats(uuid, timestamptz, timestamptz) to authenticated;

commit;
