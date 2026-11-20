begin;

-- 1. Dashboard figures leave out calls handled by transfer agents, as Call History does, unless asked.
-- Same rules as before: read-only, run as the caller, count only the caller's workspace, UK days.
drop function public.call_daily_stats(timestamptz, timestamptz);
drop function public.call_agent_stats(timestamptz, timestamptz);

create function public.call_daily_stats(from_ts timestamptz, to_ts timestamptz, include_transfers boolean default false)
returns table (day date, total integer, connected integer, connected_ms bigint, timed integer)
language sql stable security invoker set search_path = ''
as $$
  select (c.started_at at time zone 'Europe/London')::date,
         count(*)::integer,
         (count(*) filter (where c.call_status = 'ended'))::integer,
         coalesce(sum(c.duration_ms) filter (where c.call_status = 'ended'), 0)::bigint,
         (count(c.duration_ms) filter (where c.call_status = 'ended'))::integer
  from public.calls c
  join public.agents a on a.id = c.agent_id and a.workspace_id = c.workspace_id
  where c.started_at >= from_ts and c.started_at < to_ts
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
    and (include_transfers or not a.is_transfer_agent)
  group by 1
  order by 1
$$;

create function public.call_agent_stats(from_ts timestamptz, to_ts timestamptz, include_transfers boolean default false)
returns table (agent_id uuid, total integer, connected integer, connected_ms bigint, timed integer)
language sql stable security invoker set search_path = ''
as $$
  select c.agent_id,
         count(*)::integer,
         (count(*) filter (where c.call_status = 'ended'))::integer,
         coalesce(sum(c.duration_ms) filter (where c.call_status = 'ended'), 0)::bigint,
         (count(c.duration_ms) filter (where c.call_status = 'ended'))::integer
  from public.calls c
  join public.agents a on a.id = c.agent_id and a.workspace_id = c.workspace_id
  where c.started_at >= from_ts and c.started_at < to_ts
    and c.workspace_id = (select m.workspace_id from public.memberships m where m.user_id = (select auth.uid()))
    and (include_transfers or not a.is_transfer_agent)
  group by 1
  order by 2 desc
$$;

revoke all on function public.call_daily_stats(timestamptz, timestamptz, boolean) from public, anon;
revoke all on function public.call_agent_stats(timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.call_daily_stats(timestamptz, timestamptz, boolean) to authenticated;
grant execute on function public.call_agent_stats(timestamptz, timestamptz, boolean) to authenticated;

-- 2. Whether a client may play their own recordings and read transcripts once client logins exist.
-- Off by default. Owners and admins change it, under the existing staff_update policy on clients.
alter table public.clients add column recordings_for_client boolean not null default false;

commit;
