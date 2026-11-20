# Retell Voice AI Management Platform

Phase 1 provides a Next.js App Router application for internal workspace staff. Dashboard counts the local records. My Agents, Call History, Client Management, User Permissions and Branding & Settings have read-only views of their respective tables. Lists show up to 100 records. Retell is disconnected.

## Development setup

Use Node.js 22. Install with `npm ci`, copy `.env.example` to `.env.local` and fill in the URL and publishable key for a dedicated Supabase development project. Start with `npm run dev`. Do not add a secret or service-role key. The build and database tests can run without credentials.

## Provision the development database

1. Create a dedicated Supabase project in your chosen organisation and region. In Authentication settings enable email/password and turn off new user sign-ups. Use HTTPS for hosted environments. Set the Site URL to the development app's origin before distributing it.
2. Apply every file in `supabase/migrations/` once, in filename order, to that project in the SQL Editor, or apply the tracked migrations using the Supabase CLI against that project.
3. In Authentication → Users, create a confirmed account for the initial owner using a unique password. Copy that user's UUID. Run the following in the SQL Editor after replacing the placeholder. Both inserts form one atomic statement.

```sql
with workspace as (
  insert into public.workspaces(name) values ('Voice Operations') returning id
)
insert into public.memberships(workspace_id,user_id,role)
select id, 'REPLACE_WITH_AUTH_USER_UUID'::uuid, 'owner' from workspace;
```

4. Sign in as that user and confirm an empty dashboard. Create additional staff accounts through the same trusted admin channel. Each staff account belongs to one workspace. A signed-in account without membership reaches the access-required page. Client records represent managed customers. External client logins are outside this foundation.

## Permissions and data

Supabase Auth supplies verified identities. Supabase SSR handles cookie-backed sessions and refresh. Every protected data page verifies identity and membership. PostgreSQL enforces workspace boundaries with row-level security. Owners read the member directory and write branding records. Owners and admins write client records. Admins and viewers read workspace data and their own membership only. Branding is created by an owner, so a workspace needs an owner for its branding to be set through the application. Only a trusted database administrator provisions memberships in this phase. Agent and call data are read-only for all application users. Foreign keys prevent an agent or call from being linked to a record in a different workspace.

## Codex Cloud and checks

Connect GitHub in Codex Cloud and select the private repository. Use Node.js 22 and `npm ci` for environment setup. Work on branches and review pull requests. GitHub Actions runs the database tests, Next.js build and TypeScript checks on pushes and pull requests. Use `npm test && npm run build && npm run typecheck` locally. The SQL tests run the migration in embedded PostgreSQL with a small Supabase Auth schema fixture. A real development-project sign-in and session refresh are still required as an integration check.

Do not import agents, create webhooks, place calls or configure Retell credentials during Phase 1.
