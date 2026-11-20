begin;

-- How each client's portal will look: a display name, a main colour and an optional small logo.
-- Logos are kept here as base64 (256 KB at most) so there is no separate file store to secure.
create table public.client_branding (
  client_id uuid primary key,
  workspace_id uuid not null,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  accent_colour text not null default '#2D3C97' check (accent_colour ~ '^#[0-9A-F]{6}$'),
  logo_mime text check (logo_mime in ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml')),
  logo_base64 text check (length(logo_base64) <= 350000 and logo_base64 ~ '^[A-Za-z0-9+/]+={0,2}$'),
  updated_at timestamptz not null default now(),
  check ((logo_mime is null) = (logo_base64 is null)),
  -- Removed with its client, and always in the client's own workspace.
  foreign key (workspace_id, client_id) references public.clients (workspace_id, id) on delete cascade
);

alter table public.client_branding enable row level security;
revoke all on public.client_branding from public, anon, authenticated;
grant select on public.client_branding to authenticated;
grant insert (client_id, workspace_id, display_name, accent_colour, logo_mime, logo_base64, updated_at) on public.client_branding to authenticated;
grant update (display_name, accent_colour, logo_mime, logo_base64, updated_at) on public.client_branding to authenticated;

create policy member_read on public.client_branding for select to authenticated
  using (private.workspace_role(workspace_id) is not null);
create policy staff_insert on public.client_branding for insert to authenticated
  with check (private.workspace_role(workspace_id) in ('owner', 'admin'));
create policy staff_update on public.client_branding for update to authenticated
  using (private.workspace_role(workspace_id) in ('owner', 'admin'))
  with check (private.workspace_role(workspace_id) in ('owner', 'admin'));

commit;
