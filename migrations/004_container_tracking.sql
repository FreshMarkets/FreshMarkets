-- Migration 004: Container tracking fields
-- Run in Supabase SQL editor

alter table shipments
  add column if not exists container_number    text,
  add column if not exists sealine_scac        text,
  add column if not exists tracking_status     text,
  add column if not exists tracking_eta        timestamptz,
  add column if not exists tracking_updated_at timestamptz,
  add column if not exists tracking_events     jsonb;

comment on column shipments.container_number    is 'Container / BL / BK number for SafeCube tracking';
comment on column shipments.sealine_scac        is 'Carrier SCAC code (e.g. MSCU, MAEU) for faster SafeCube lookup';
comment on column shipments.tracking_status     is 'Last known status from SafeCube (e.g. IN_TRANSIT, DELIVERED)';
comment on column shipments.tracking_eta        is 'Predictive ETA at POD from SafeCube';
comment on column shipments.tracking_updated_at is 'When tracking was last refreshed from SafeCube';
comment on column shipments.tracking_events     is 'Full SafeCube events array (jsonb) — port events timeline';
