-- =========================================================================
-- CLERIVO — Initial schema
-- PostgreSQL via Supabase. Cada usuario tiene 1 negocio. Cada negocio
-- tiene 0-1 agente, 0-1 cuenta de WhatsApp, N conversaciones, etc.
-- RLS está activado en todas las tablas: cada usuario solo lee y escribe
-- su propio negocio. El backend con la SERVICE_ROLE_KEY bypassa RLS para
-- el procesamiento async de webhooks.
-- =========================================================================

-- ─── extensions ─────────────────────────────────────────────────────────
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ─── businesses ─────────────────────────────────────────────────────────
create table if not exists public.businesses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users(id) on delete cascade,
  name         text,
  industry     text,
  country      text,
  currency     text,
  hours        text,
  description  text,
  logo_url     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists businesses_user_id_idx on public.businesses(user_id);

alter table public.businesses enable row level security;

drop policy if exists "businesses owner select" on public.businesses;
create policy "businesses owner select"
  on public.businesses for select
  using (user_id = auth.uid());

drop policy if exists "businesses owner update" on public.businesses;
create policy "businesses owner update"
  on public.businesses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── helpers ────────────────────────────────────────────────────────────
-- Devuelve el business_id del usuario autenticado, o null si no tiene.
create or replace function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.businesses where user_id = auth.uid() limit 1;
$$;

-- Cada usuario nuevo en auth.users dispara la creación de su business empty.
-- Así toda la app puede asumir que `current_business_id()` ya existe.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.businesses (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── agents ─────────────────────────────────────────────────────────────
create table if not exists public.agents (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null unique references public.businesses(id) on delete cascade,
  name               text not null,
  main_goal          text,
  description        text,
  short_description  text,
  instructions       text,
  tones              jsonb not null default '[]'::jsonb,
  primary_tone       text,
  language           text not null default 'es',
  use_emojis         boolean not null default false,
  escalate_complex   boolean not null default true,
  prioritize_tone    boolean not null default true,
  enabled            boolean not null default true,
  avatar_url         text,
  allowed_topics     jsonb not null default '[]'::jsonb,
  forbidden_claims   jsonb not null default '[]'::jsonb,
  escalation_rules   jsonb not null default '[]'::jsonb,
  hot_lead_rules     jsonb not null default '[]'::jsonb,
  operating_mode     text not null default 'auto',
  ai_provider        text not null default 'anthropic' check (ai_provider in ('anthropic')),
  ai_model           text not null default 'claude-sonnet-4-6',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists agents_business_id_idx on public.agents(business_id);

alter table public.agents enable row level security;

drop policy if exists "agents owner all" on public.agents;
create policy "agents owner all"
  on public.agents for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ─── whatsapp_accounts ──────────────────────────────────────────────────
create table if not exists public.whatsapp_accounts (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references public.businesses(id) on delete cascade,
  phone_number_id         text not null unique,
  display_phone_number    text,
  access_token_encrypted  text not null, -- AES-GCM ciphertext
  webhook_verify_token    text not null,
  status                  text not null default 'pending'
                            check (status in ('pending','verified','active','suspended','error')),
  last_error              text,
  verified_at             timestamptz,
  activated_at            timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists wa_accounts_business_id_idx on public.whatsapp_accounts(business_id);
create index if not exists wa_accounts_phone_number_id_idx on public.whatsapp_accounts(phone_number_id);

alter table public.whatsapp_accounts enable row level security;

drop policy if exists "wa_accounts owner select" on public.whatsapp_accounts;
create policy "wa_accounts owner select"
  on public.whatsapp_accounts for select
  using (business_id = public.current_business_id());

-- Insert/update/delete sólo desde el backend (service_role bypass).
-- No declaramos policies de modificación → bloqueado para clientes regulares.

-- ─── conversations ──────────────────────────────────────────────────────
create table if not exists public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses(id) on delete cascade,
  channel              text not null check (channel in ('whatsapp','instagram')),
  contact_wa_id        text,
  contact_name         text,
  contact_phone        text,
  lead_status          text not null default 'nuevo'
                         check (lead_status in ('nuevo','interesado','caliente','seguimiento','cliente','perdido')),
  handler              text not null default 'bot' check (handler in ('bot','human')),
  unread_count         integer not null default 0,
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now(),
  unique (business_id, channel, contact_wa_id)
);

create index if not exists conv_business_last_msg_idx
  on public.conversations(business_id, last_message_at desc);
create index if not exists conv_business_lead_idx
  on public.conversations(business_id, lead_status);

alter table public.conversations enable row level security;

drop policy if exists "conv owner select" on public.conversations;
create policy "conv owner select"
  on public.conversations for select
  using (business_id = public.current_business_id());

drop policy if exists "conv owner update" on public.conversations;
create policy "conv owner update"
  on public.conversations for update
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ─── messages ───────────────────────────────────────────────────────────
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  business_id     uuid not null references public.businesses(id) on delete cascade,
  direction       text not null check (direction in ('in','out')),
  author          text not null check (author in ('client','bot','human')),
  body            text not null,
  wa_message_id   text unique,
  delivered_at    timestamptz,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists msg_conv_created_idx on public.messages(conversation_id, created_at);
create index if not exists msg_business_created_idx on public.messages(business_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "msg owner select" on public.messages;
create policy "msg owner select"
  on public.messages for select
  using (business_id = public.current_business_id());

drop policy if exists "msg owner insert" on public.messages;
create policy "msg owner insert"
  on public.messages for insert
  with check (business_id = public.current_business_id());

-- ─── activity_events ────────────────────────────────────────────────────
create table if not exists public.activity_events (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  kind            text not null,
  title           text not null,
  subtitle        text,
  conversation_id uuid references public.conversations(id) on delete set null,
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index if not exists activity_business_created_idx
  on public.activity_events(business_id, created_at desc);
create index if not exists activity_business_unread_idx
  on public.activity_events(business_id) where read_at is null;

alter table public.activity_events enable row level security;

drop policy if exists "activity owner select" on public.activity_events;
create policy "activity owner select"
  on public.activity_events for select
  using (business_id = public.current_business_id());

drop policy if exists "activity owner update" on public.activity_events;
create policy "activity owner update"
  on public.activity_events for update
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

-- ─── simulator_sessions + simulator_messages ───────────────────────────
create table if not exists public.simulator_sessions (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.simulator_sessions enable row level security;

drop policy if exists "sim_sessions owner all" on public.simulator_sessions;
create policy "sim_sessions owner all"
  on public.simulator_sessions for all
  using (business_id = public.current_business_id())
  with check (business_id = public.current_business_id());

create table if not exists public.simulator_messages (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.simulator_sessions(id) on delete cascade,
  role       text not null check (role in ('user','assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists sim_msg_session_created_idx
  on public.simulator_messages(session_id, created_at);

alter table public.simulator_messages enable row level security;

drop policy if exists "sim_msg owner all" on public.simulator_messages;
create policy "sim_msg owner all"
  on public.simulator_messages for all
  using (
    session_id in (
      select id from public.simulator_sessions
      where business_id = public.current_business_id()
    )
  );

-- ─── webhook_dedupe ─────────────────────────────────────────────────────
-- Para idempotencia de webhooks de WhatsApp. Solo backend escribe (service_role).
create table if not exists public.webhook_dedupe (
  wa_message_id text primary key,
  processed_at  timestamptz not null default now()
);

alter table public.webhook_dedupe enable row level security;

-- Backend-only table. service_role bypassa RLS; clientes no tienen acceso.
revoke all on public.webhook_dedupe from anon, authenticated;

-- ─── updated_at triggers ────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists businesses_updated_at on public.businesses;
create trigger businesses_updated_at
  before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();
