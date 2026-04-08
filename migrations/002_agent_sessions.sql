-- ============================================================
-- 002_agent_sessions.sql — Agent preview-gate session state
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

create table if not exists agent_sessions (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  messages_json   jsonb not null,
  pending_tool    text not null,
  pending_inputs  jsonb not null,
  file_buffers    jsonb,
  status          text not null default 'pending'
                  check (status in ('pending','executed','cancelled')),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '30 minutes'
);

create index if not exists agent_sessions_conversation_id_idx
  on agent_sessions(conversation_id);

create index if not exists agent_sessions_status_idx
  on agent_sessions(status);
