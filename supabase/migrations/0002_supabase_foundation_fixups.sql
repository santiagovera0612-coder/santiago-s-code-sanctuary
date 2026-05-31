-- =========================================================================
-- CLERIVO - Supabase foundation fixups
--
-- Incremental hardening after 0001:
-- - keep SECURITY DEFINER helpers outside exposed schemas
-- - enable RLS on every application table, including backend-only tables
-- - add catalog/context tables needed to remove localStorage in later blocks
-- - add private Storage bucket policies for business assets
-- - enable Supabase Realtime publication for chat/activity tables
-- =========================================================================

create schema if not exists app_private;

revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;
grant usage on schema app_private to service_role;

create or replace function app_private.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.businesses
  where user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function app_private.current_business_id() from public;
grant execute on function app_private.current_business_id() to authenticated;
grant execute on function app_private.current_business_id() to service_role;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.businesses (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function app_private.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- Keep the business profile ready for the settings screen migration.
alter table public.businesses
  add column if not exists website_url text,
  add column if not exists instagram_url text,
  add column if not exists whatsapp_number text;

-- Keep the agent profile aligned with the current UI shape.
alter table public.agents
  add column if not exists follow_up_rules jsonb not null default '[]'::jsonb,
  add column if not exists catalog_enabled boolean not null default true;

-- Catalog created in /app/create. Values are scoped by business_id via RLS.
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name        text not null,
  description text,
  category    text,
  price       numeric(12, 2),
  currency    text,
  stock       integer,
  image_url   text,
  active      boolean not null default true,
  ai_notes    text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists products_business_active_idx
  on public.products(business_id, active);
create index if not exists products_business_category_idx
  on public.products(business_id, category);

alter table public.products enable row level security;

drop policy if exists "products owner all" on public.products;
create policy "products owner all"
  on public.products for all
  to authenticated
  using (business_id = (select app_private.current_business_id()))
  with check (business_id = (select app_private.current_business_id()));

-- Links, PDFs and notes used as business context for the agent.
create table if not exists public.business_context_items (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses(id) on delete cascade,
  type         text not null check (type in ('link', 'pdf', 'note')),
  label        text not null,
  value        text not null,
  storage_path text,
  size_bytes   bigint,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists context_items_business_created_idx
  on public.business_context_items(business_id, created_at desc);

alter table public.business_context_items enable row level security;

drop policy if exists "context_items owner all" on public.business_context_items;
create policy "context_items owner all"
  on public.business_context_items for all
  to authenticated
  using (business_id = (select app_private.current_business_id()))
  with check (business_id = (select app_private.current_business_id()));

-- RLS hardening for all application tables, including backend-only tables.
alter table public.businesses enable row level security;
alter table public.agents enable row level security;
alter table public.whatsapp_accounts enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.activity_events enable row level security;
alter table public.simulator_sessions enable row level security;
alter table public.simulator_messages enable row level security;
alter table public.webhook_dedupe enable row level security;

-- Recreate policies so they use private helper functions and explicit roles.
drop policy if exists "businesses owner select" on public.businesses;
create policy "businesses owner select"
  on public.businesses for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "businesses owner update" on public.businesses;
create policy "businesses owner update"
  on public.businesses for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "agents owner all" on public.agents;
create policy "agents owner all"
  on public.agents for all
  to authenticated
  using (business_id = (select app_private.current_business_id()))
  with check (business_id = (select app_private.current_business_id()));

drop policy if exists "wa_accounts owner select" on public.whatsapp_accounts;
create policy "wa_accounts owner select"
  on public.whatsapp_accounts for select
  to authenticated
  using (business_id = (select app_private.current_business_id()));

drop policy if exists "conv owner select" on public.conversations;
create policy "conv owner select"
  on public.conversations for select
  to authenticated
  using (business_id = (select app_private.current_business_id()));

drop policy if exists "conv owner update" on public.conversations;
create policy "conv owner update"
  on public.conversations for update
  to authenticated
  using (business_id = (select app_private.current_business_id()))
  with check (business_id = (select app_private.current_business_id()));

drop policy if exists "msg owner select" on public.messages;
create policy "msg owner select"
  on public.messages for select
  to authenticated
  using (business_id = (select app_private.current_business_id()));

drop policy if exists "msg owner insert" on public.messages;
create policy "msg owner insert"
  on public.messages for insert
  to authenticated
  with check (business_id = (select app_private.current_business_id()));

drop policy if exists "activity owner select" on public.activity_events;
create policy "activity owner select"
  on public.activity_events for select
  to authenticated
  using (business_id = (select app_private.current_business_id()));

drop policy if exists "activity owner update" on public.activity_events;
create policy "activity owner update"
  on public.activity_events for update
  to authenticated
  using (business_id = (select app_private.current_business_id()))
  with check (business_id = (select app_private.current_business_id()));

drop policy if exists "sim_sessions owner all" on public.simulator_sessions;
create policy "sim_sessions owner all"
  on public.simulator_sessions for all
  to authenticated
  using (business_id = (select app_private.current_business_id()))
  with check (business_id = (select app_private.current_business_id()));

drop policy if exists "sim_msg owner all" on public.simulator_messages;
create policy "sim_msg owner all"
  on public.simulator_messages for all
  to authenticated
  using (
    session_id in (
      select id
      from public.simulator_sessions
      where business_id = (select app_private.current_business_id())
    )
  )
  with check (
    session_id in (
      select id
      from public.simulator_sessions
      where business_id = (select app_private.current_business_id())
    )
  );

-- Keep grants explicit. RLS still decides which rows are visible/mutable.
grant select, update on public.businesses to authenticated;
grant select, insert, update, delete on public.agents to authenticated;
grant select on public.whatsapp_accounts to authenticated;
grant select, update on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;
grant select, update on public.activity_events to authenticated;
grant select, insert, update, delete on public.simulator_sessions to authenticated;
grant select, insert, update, delete on public.simulator_messages to authenticated;
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.business_context_items to authenticated;

-- Backend-only idempotency table intentionally has no authenticated policies.
revoke all on public.webhook_dedupe from anon, authenticated;

-- Private Supabase Storage bucket for business logos/assets/context files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-assets',
  'business-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists "business assets owner select" on storage.objects;
create policy "business assets owner select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = (select app_private.current_business_id())::text
  );

drop policy if exists "business assets owner insert" on storage.objects;
create policy "business assets owner insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = (select app_private.current_business_id())::text
  );

drop policy if exists "business assets owner update" on storage.objects;
create policy "business assets owner update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = (select app_private.current_business_id())::text
  )
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = (select app_private.current_business_id())::text
  );

drop policy if exists "business assets owner delete" on storage.objects;
create policy "business assets owner delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] = (select app_private.current_business_id())::text
  );

-- Supabase Realtime for chat and activity surfaces. The publication exists
-- in hosted Supabase; the guard keeps local/fallback databases from failing.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversations'
    ) then
      alter publication supabase_realtime add table public.conversations;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'activity_events'
    ) then
      alter publication supabase_realtime add table public.activity_events;
    end if;
  end if;
end $$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists context_items_updated_at on public.business_context_items;
create trigger context_items_updated_at
  before update on public.business_context_items
  for each row execute function public.set_updated_at();

drop function if exists public.current_business_id();
drop function if exists public.handle_new_user();
