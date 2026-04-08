-- ============================================================
-- 001_initial.sql — Freshzilla Supply Chain Schema
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- -------------------------------------------------------
-- USERS
-- -------------------------------------------------------
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  email        text not null unique,
  name         text not null,
  role         text not null default 'user'
               check (role in ('admin','user','warehouse','finance','viewer')),
  company      text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- -------------------------------------------------------
-- CONTACTS
-- -------------------------------------------------------
create table if not exists contacts (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  type                  text not null
                        check (type in ('warehouse','carrier','broker','customer')),
  email                 text not null,
  phone                 text,
  address               text,
  city                  text,
  country               text,
  is_active             boolean not null default true,
  google_sheets_row_id  text unique,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- -------------------------------------------------------
-- SHIPMENTS
-- -------------------------------------------------------
create table if not exists shipments (
  id                      uuid primary key default gen_random_uuid(),
  reference               text not null unique,
  status                  text not null default 'draft'
                          check (status in ('draft','pending_approval','sent','confirmed','delivered')),
  origin_contact_id       uuid references contacts(id) on delete set null,
  destination_contact_id  uuid references contacts(id) on delete set null,
  carrier_id              uuid references contacts(id) on delete set null,
  description             text not null,
  weight_kg               numeric,
  volume_cbm              numeric,
  value_usd               numeric,
  currency                text not null default 'USD',
  hs_code                 text,
  incoterm                text
                          check (incoterm in ('FCA','CIF','FOB','EXW','DDP','DAP','CPT','CIP')),
  special_handling        text,
  created_by              text not null default 'system',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  google_sheets_row_id    text,
  drive_folder_id         text
);

-- -------------------------------------------------------
-- EMAIL DRAFTS
-- -------------------------------------------------------
create table if not exists email_drafts (
  id               uuid primary key default gen_random_uuid(),
  shipment_id      uuid references shipments(id) on delete set null,
  draft_type       text not null
                   check (draft_type in ('booking','customs','load_request','notification')),
  recipient_email  text not null,
  cc_emails        text[] not null default '{}',
  subject          text not null,
  body             text not null,
  status           text not null default 'draft'
                   check (status in ('draft','pending_approval','approved','sent','rejected')),
  generated_by     text not null default 'claude'
                   check (generated_by in ('claude','template','manual')),
  approved_by      text,
  sent_at          timestamptz,
  gmail_message_id text,
  created_at       timestamptz not null default now()
);

-- -------------------------------------------------------
-- CONVERSATIONS
-- -------------------------------------------------------
create table if not exists conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default 'system',
  shipment_id uuid references shipments(id) on delete set null,
  title       text not null,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------
-- MESSAGES
-- -------------------------------------------------------
create table if not exists messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversations(id) on delete cascade,
  role             text not null check (role in ('user','assistant')),
  content          text not null,
  created_at       timestamptz not null default now()
);

-- -------------------------------------------------------
-- AUTOMATION LOGS
-- -------------------------------------------------------
create table if not exists automation_logs (
  id            uuid primary key default gen_random_uuid(),
  event_type    text not null,
  shipment_id   uuid references shipments(id) on delete set null,
  user_id       text,
  details       jsonb not null default '{}',
  status        text not null default 'pending'
                check (status in ('success','error','pending')),
  error_message text,
  created_at    timestamptz not null default now()
);

-- -------------------------------------------------------
-- APPROVALS
-- -------------------------------------------------------
create table if not exists approvals (
  id              uuid primary key default gen_random_uuid(),
  email_draft_id  uuid not null references email_drafts(id) on delete cascade,
  requested_by    text not null,
  assigned_to     text not null,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  comment         text,
  created_at      timestamptz not null default now(),
  decided_at      timestamptz
);

-- -------------------------------------------------------
-- updated_at trigger
-- -------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger contacts_updated_at
  before update on contacts
  for each row execute function set_updated_at();

create trigger shipments_updated_at
  before update on shipments
  for each row execute function set_updated_at();

-- -------------------------------------------------------
-- Indexes
-- -------------------------------------------------------
create index if not exists idx_contacts_type           on contacts(type);
create index if not exists idx_contacts_is_active      on contacts(is_active);
create index if not exists idx_shipments_status        on shipments(status);
create index if not exists idx_shipments_created_by    on shipments(created_by);
create index if not exists idx_email_drafts_shipment   on email_drafts(shipment_id);
create index if not exists idx_email_drafts_status     on email_drafts(status);
create index if not exists idx_messages_conversation   on messages(conversation_id, created_at asc);
create index if not exists idx_automation_logs_event   on automation_logs(event_type, created_at desc);
