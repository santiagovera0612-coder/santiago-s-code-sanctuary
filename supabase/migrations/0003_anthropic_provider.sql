-- =========================================================================
-- CLERIVO - Claude/Anthropic provider metadata
--
-- Existing Supabase projects may already have 0001/0002 applied. This
-- migration marks every agent as using Claude through Anthropic's Messages
-- API and stores the model ID used by the backend.
-- =========================================================================

alter table public.agents
  add column if not exists ai_provider text not null default 'anthropic',
  add column if not exists ai_model text not null default 'claude-sonnet-4-6';

update public.agents
set
  ai_provider = 'anthropic',
  ai_model = case
    when nullif(ai_model, '') is null then 'claude-sonnet-4-6'
    when ai_model = 'claude-sonnet-4-20250514' then 'claude-sonnet-4-6'
    else ai_model
  end;

alter table public.agents
  drop constraint if exists agents_ai_provider_check;

alter table public.agents
  add constraint agents_ai_provider_check
  check (ai_provider in ('anthropic'));

alter table public.agents
  alter column ai_provider set default 'anthropic',
  alter column ai_model set default 'claude-sonnet-4-6';
