'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
import Link from 'next/link';
import {
  Ship,
  Search,
  RefreshCw,
  CheckCircle2,
  Circle,
  Save,
  MapPin,
  Calendar,
  Anchor,
  ArrowRight,
  Hash,
  Trash2,
  Navigation,
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import type { Shipment, SafeCubeEvent } from '@/types';

// ---- Helpers ----

const EVENT_CODE_LABELS: Record<string, string> = {
  GTOT: 'Gate Out',
  GTIN: 'Gate In',
  ARRI: 'Arrived',
  DEPA: 'Departed',
  LDND: 'Loaded',
  DSCH: 'Discharged',
  STRP: 'Stripped',
  STUF: 'Stuffed',
  RMVD: 'Removed',
};

// ---- Row status (color coding) ----

type RowStatus = 'in_transit' | 'in_production' | 'not_started';

const ROW_STATUS_OPTIONS: { value: RowStatus; label: string; color: string; bg: string; borderL: string }[] = [
  { value: 'in_transit',    label: 'In Transit',      color: 'text-emerald-700', bg: 'bg-emerald-500/8',  borderL: 'border-l-emerald-500' },
  { value: 'in_production', label: 'In Production',   color: 'text-amber-700',   bg: 'bg-amber-400/8',    borderL: 'border-l-amber-400' },
  { value: 'not_started',   label: 'Not Started',     color: 'text-red-600',     bg: 'bg-red-500/8',      borderL: 'border-l-red-500' },
];

function getRowStatus(s: Shipment): RowStatus {
  if (s.loading_status === 'in_production' || s.loading_status === 'in_transit' || s.loading_status === 'not_started') {
    return s.loading_status as RowStatus;
  }
  // Auto-detect from tracking data
  if (s.tracking_status === 'IN_TRANSIT' || s.tracking_status === 'DELIVERED' || s.container_number) return 'in_transit';
  return 'not_started';
}

function getRowColors(status: RowStatus) {
  return ROW_STATUS_OPTIONS.find((o) => o.value === status) ?? ROW_STATUS_OPTIONS[2];
}

function RowStatusDot({ shipment, onSaved }: { shipment: Shipment; onSaved: (id: string, field: string, val: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const status = getRowStatus(shipment);
  const colors = getRowColors(status);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const handleSelect = async (val: RowStatus) => {
    setOpen(false);
    onSaved(shipment.id, 'loading_status', val);
    try {
      await fetch(`/api/tracking/${shipment.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loading_status: val }),
      });
    } catch { onSaved(shipment.id, 'loading_status', shipment.loading_status); }
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className={`w-3 h-3 rounded-full border-2 cursor-pointer transition hover:scale-125 ${
          status === 'in_transit' ? 'bg-emerald-500 border-emerald-600' :
          status === 'in_production' ? 'bg-amber-400 border-amber-500' :
          'bg-red-500 border-red-600'
        }`}
        title={colors.label}
      />
      {open && (
        <div className="absolute left-0 top-5 z-50 bg-[var(--color-fz-surface)] border border-[var(--color-fz-border)] rounded-lg shadow-lg py-1 w-36 animate-fade-in-up">
          {ROW_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className={`w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-[var(--color-fz-surface-2)] transition ${
                opt.value === status ? 'font-semibold' : ''
              }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${
                opt.value === 'in_transit' ? 'bg-emerald-500' :
                opt.value === 'in_production' ? 'bg-amber-400' :
                'bg-red-500'
              }`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function statusChip(status: string | null) {
  let cls = 'text-[var(--color-fz-text-muted)] bg-[var(--color-fz-surface-2)]';
  if (status === 'IN_TRANSIT') cls = 'text-[#00A082] bg-[#00A082]/10';
  else if (status === 'DELIVERED') cls = 'text-emerald-600 bg-emerald-500/10';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>
      {status === 'IN_TRANSIT' ? <Ship size={10} /> : status === 'DELIVERED' ? <CheckCircle2 size={10} /> : <Circle size={10} />}
      {status ?? '—'}
    </span>
  );
}

// ---- Editable Cell ----

function EditableCell({
  value, shipmentId, field, onSaved, placeholder, mono,
}: {
  value: string | null; shipmentId: string; field: string;
  onSaved: (id: string, field: string, val: string | null) => void;
  placeholder?: string; mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = draft.trim() || null;
    if (trimmed === (value ?? null)) return;
    onSaved(shipmentId, field, trimmed);
    try {
      await fetch(`/api/tracking/${shipmentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: trimmed }),
      });
    } catch { onSaved(shipmentId, field, value); }
  };

  if (editing) {
    return (
      <input ref={inputRef}
        className={`w-full bg-transparent border-b border-[#00A082] outline-none text-xs py-0.5 ${mono ? 'font-mono' : ''}`}
        value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:text-[#00A082] transition text-xs truncate block ${mono ? 'font-mono' : ''} ${!value ? 'text-[var(--color-fz-text-muted)] italic' : ''}`}
      onClick={() => { setDraft(value ?? ''); setEditing(true); }}
      title="Click to edit"
    >
      {value || placeholder || '—'}
    </span>
  );
}

// ---- Date Cell (calendar picker) ----

function DateCell({
  value, shipmentId, field, onSaved, fallback,
}: {
  value: string | null; shipmentId: string; field: string;
  onSaved: (id: string, field: string, val: string | null) => void;
  fallback?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDate = (d: Date) => {
    const day = d.getDate().toString().padStart(2, '0');
    const mon = d.toLocaleDateString('en-GB', { month: 'short' });
    const yr = d.getFullYear().toString().slice(-2);
    return `${day}-${mon}-${yr}`;
  };

  const displayValue = value
    ? formatDate(new Date(value + 'T00:00:00'))
    : fallback || '—';

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value || null;
    onSaved(shipmentId, field, val);
    try {
      await fetch(`/api/tracking/${shipmentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val }),
      });
    } catch { onSaved(shipmentId, field, value); }
  };

  const openPicker = () => {
    inputRef.current?.showPicker?.();
    inputRef.current?.click();
  };

  return (
    <div className="relative inline-block">
      <span
        className={`cursor-pointer hover:text-[#00A082] transition text-xs block ${value ? 'font-medium' : 'text-[var(--color-fz-text-muted)]'}`}
        onClick={openPicker}
        title="Click to pick date"
      >
        {displayValue}
      </span>
      <input
        ref={inputRef}
        type="date"
        className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
        value={value ?? ''}
        onChange={handleChange}
      />
    </div>
  );
}

// ---- Quick-Track Section ----

interface TrackingResult {
  status: string; sealine: string | null; eta: string | null;
  events: SafeCubeEvent[]; vessel: string | null;
  route: { pol: string | null; pol_country: string | null; pod: string | null; pod_country: string | null };
  current_location: { name: string | null; country: string | null; event: string; date: string } | null;
}

function QuickTrack({ onTracked }: { onTracked: () => void }) {
  const [containerNumber, setContainerNumber] = useState('');
  const [shipmentType, setShipmentType] = useState<'CT' | 'BL' | 'BK'>('CT');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async () => {
    const num = containerNumber.trim().toUpperCase();
    if (!num) return;
    setLoading(true); setError(null); setResult(null); setSaved(false);
    try {
      const res = await fetch('/api/tracking/lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: num, shipment_type: shipmentType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tracking lookup failed');
      setResult(data);
    } catch (err) { setError(String(err)); } finally { setLoading(false); }
  };

  const handleSave = async () => {
    const num = containerNumber.trim().toUpperCase();
    if (!num) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/tracking/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: num, shipment_type: shipmentType }),
      });
      const data = await res.json();
      if (!res.ok) { if (res.status === 409) setSaved(true); else throw new Error(data.error || 'Failed to save'); }
      else { setSaved(true); onTracked(); }
    } catch (err) { setError(String(err)); } finally { setSaving(false); }
  };

  return (
    <div className="glass-card p-5 space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Search size={15} className="text-[#00A082]" /> Quick Track
      </h3>
      <div className="flex gap-3">
        <select
          value={shipmentType}
          onChange={(e) => setShipmentType(e.target.value as 'CT' | 'BL' | 'BK')}
          className="px-3 py-2.5 rounded-xl border border-[var(--color-fz-border)] bg-[var(--color-fz-surface)] text-sm font-medium shrink-0"
        >
          <option value="CT">Container</option>
          <option value="BL">Bill of Lading</option>
          <option value="BK">Booking</option>
        </select>
        <div className="relative flex-1 min-w-0">
          <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-fz-text-muted)]" />
          <input type="text" placeholder={shipmentType === 'CT' ? 'Enter container number...' : shipmentType === 'BL' ? 'Enter BL number...' : 'Enter booking number...'}
            className="input font-mono w-full" style={{ paddingLeft: '3.25rem' }}
            value={containerNumber} onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleTrack()} />
        </div>
        <button onClick={handleTrack} disabled={loading || !containerNumber.trim()} className="btn-primary shrink-0">
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
          {loading ? 'Tracking...' : 'Track'}
        </button>
      </div>
      {error && <div className="px-3 py-2 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 text-xs text-[#D93636]">{error}</div>}
      {result && (
        <div className="flex items-center gap-4 flex-wrap animate-fade-in-up animate-fade-in-up-1">
          {statusChip(result.status)}
          {result.eta && <span className="text-sm text-[var(--color-fz-text-secondary)] flex items-center gap-1.5"><Calendar size={14} className="text-[#00A082]" /> ETA <strong>{new Date(result.eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>}
          {result.vessel && <span className="text-sm text-[var(--color-fz-text-muted)] flex items-center gap-1.5"><Anchor size={14} /> {result.vessel}</span>}
          {(result.route.pol || result.route.pod) && <span className="text-sm flex items-center gap-1.5"><MapPin size={14} className="text-[var(--color-fz-text-muted)]" /> {result.route.pol || '—'} <ArrowRight size={12} className="text-[var(--color-fz-text-muted)]" /> {result.route.pod || '—'}</span>}
          {result.current_location?.name && <span className="text-xs text-[#007AFF] flex items-center gap-1"><Navigation size={12} /> Now: {result.current_location.name}</span>}
          {!saved ? (
            <button onClick={handleSave} disabled={saving} className="btn-primary text-xs py-1.5 px-3 ml-auto">
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving...' : 'Save & Track'}
            </button>
          ) : <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#00A082] ml-auto"><CheckCircle2 size={13} /> Saved</span>}
        </div>
      )}
    </div>
  );
}

// ---- Main Page ----

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000;

export default function TrackingPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [autoRefreshing, setAutoRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTrackedShipments = useCallback(() => {
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    supabase
      .from('shipments')
      .select(`*, origin_contact:contacts!origin_contact_id(name, city, country),
                   destination_contact:contacts!destination_contact_id(name, city, country)`)
      .not('container_number', 'is', null)
      .order('tracking_updated_at', { ascending: false, nullsFirst: false })
      .then(({ data }) => { if (data) setShipments(data as Shipment[]); setLoading(false); });
  }, []);

  const autoRefreshAll = useCallback(async () => {
    setAutoRefreshing(true);
    try { await fetch('/api/tracking/refresh-all'); fetchTrackedShipments(); }
    finally { setAutoRefreshing(false); }
  }, [fetchTrackedShipments]);

  useEffect(() => {
    fetchTrackedShipments();
    intervalRef.current = setInterval(autoRefreshAll, AUTO_REFRESH_INTERVAL);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchTrackedShipments, autoRefreshAll]);

  const handleRefresh = async (shipment: Shipment) => {
    setRefreshingId(shipment.id);
    try {
      const res = await fetch(`/api/shipments/${shipment.id}/track`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) setShipments((prev) => prev.map((s) => s.id === shipment.id ? { ...s, ...data } : s));
    } finally { setRefreshingId(null); }
  };

  const handleDelete = async (shipment: Shipment) => {
    if (!confirm(`Remove tracking for ${shipment.container_number}?`)) return;
    setDeletingId(shipment.id);
    try {
      const res = await fetch(`/api/tracking/${shipment.id}`, { method: 'DELETE' });
      if (res.ok) setShipments((prev) => prev.filter((s) => s.id !== shipment.id));
    } finally { setDeletingId(null); }
  };

  const handleRefreshAll = async () => { for (const s of shipments) await handleRefresh(s); };

  const handleCellSave = (id: string, field: string, val: string | null) => {
    setShipments((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  };

  const getCurrentLocation = (s: Shipment) => {
    const events = Array.isArray(s.tracking_events) ? s.tracking_events : [];
    const actual = [...events].filter((e) => e.isActual).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = actual[0];
    if (latest?.location?.name) return `${latest.location.name}${latest.location.country ? ', ' + latest.location.country : ''}`;
    return null;
  };

  const getOrigin = (s: Shipment) => {
    if (s.origin_contact?.city) return `${s.origin_contact.city}${s.origin_contact.country ? ', ' + s.origin_contact.country : ''}`;
    const events = Array.isArray(s.tracking_events) ? s.tracking_events : [];
    const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0];
    if (first?.location?.name) return `${first.location.name}${first.location.country ? ', ' + first.location.country : ''}`;
    return '—';
  };

  const getDestination = (s: Shipment) => {
    if (s.destination_contact?.city) return `${s.destination_contact.city}${s.destination_contact.country ? ', ' + s.destination_contact.country : ''}`;
    const events = Array.isArray(s.tracking_events) ? s.tracking_events : [];
    const estimated = events.filter((e) => !e.isActual).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = estimated[0];
    if (last?.location?.name) return `${last.location.name}${last.location.country ? ', ' + last.location.country : ''}`;
    return '—';
  };

  const getLoadingDateISO = (s: Shipment): string | null => {
    const events = Array.isArray(s.tracking_events) ? s.tracking_events : [];
    const loadEvent = events.find((e) => e.isActual && e.eventCode === 'LDND')
      ?? events.find((e) => e.isActual && e.eventCode === 'DEPA')
      ?? events.find((e) => e.isActual && e.eventCode === 'GTOT');
    if (loadEvent) return loadEvent.date.slice(0, 10);
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up animate-fade-in-up-1">
        <div>
          <h1 className="text-2xl font-bold">Container Tracking</h1>
          <p className="text-sm text-[var(--color-fz-text-muted)]">
            {loading ? 'Loading...' : `${shipments.length} tracked containers`}
            {autoRefreshing && <span className="ml-2 text-xs text-[#00A082]"><RefreshCw size={10} className="inline animate-spin mr-1" />Auto-refreshing...</span>}
          </p>
        </div>
        {shipments.length > 0 && (
          <button onClick={handleRefreshAll} className="btn-secondary"><RefreshCw size={16} /> Refresh All</button>
        )}
      </div>

      {/* Quick Track */}
      <div className="animate-fade-in-up animate-fade-in-up-2">
        <QuickTrack onTracked={fetchTrackedShipments} />
      </div>

      {/* Table */}
      {loading && (
        <div className="text-center py-16 text-[var(--color-fz-text-muted)]">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin" /> Loading...
        </div>
      )}

      {!loading && shipments.length === 0 && (
        <div className="text-center py-16">
          <Ship size={40} className="mx-auto text-[var(--color-fz-text-muted)] mb-4" />
          <p className="text-[var(--color-fz-text-muted)]">No tracked shipments yet.</p>
          <p className="text-xs text-[var(--color-fz-text-muted)] mt-1">Use Quick Track above to start tracking containers.</p>
        </div>
      )}

      {!loading && shipments.length > 0 && (
        <div className="glass-card overflow-hidden animate-fade-in-up animate-fade-in-up-3">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-[11px]">
              <colgroup>
                <col style={{ width: '7%' }} />  {/* Status */}
                <col style={{ width: '8%' }} />  {/* PO */}
                <col style={{ width: '10%' }} /> {/* Product */}
                <col style={{ width: '10%' }} /> {/* Supplier */}
                <col style={{ width: '8%' }} />  {/* Loading */}
                <col style={{ width: '8%' }} />  {/* ETA */}
                <col style={{ width: '13%' }} /> {/* Origin */}
                <col style={{ width: '13%' }} /> {/* Destination */}
                <col style={{ width: '13%' }} /> {/* Booking/Container */}
                <col style={{ width: '10%' }} /> {/* Company */}
              </colgroup>
              <thead>
                <tr className="bg-[var(--color-fz-surface-2)] border-b border-[var(--color-fz-border)]">
                  {['Status', 'PO', 'Product', 'Supplier', 'Loading', 'ETA', 'Origin', 'Destination', 'Booking/Container', 'Company'].map((h, i) => (
                    <th key={i} className="px-2 py-2.5 text-[10px] font-semibold text-[var(--color-fz-text-muted)] uppercase tracking-wider truncate">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <Fragment key={s.id}>
                    {/* Main row */}
                    <tr className={`transition group border-t border-[var(--color-fz-border)] border-l-[3px] ${getRowColors(getRowStatus(s)).borderL} ${getRowColors(getRowStatus(s)).bg}`}>
                      {/* Status dot */}
                      <td className="px-2 py-2 text-center">
                        <RowStatusDot shipment={s} onSaved={handleCellSave} />
                      </td>

                      {/* PO */}
                      <td className="px-2 py-2 overflow-hidden">
                        <EditableCell value={s.po_number} shipmentId={s.id} field="po_number" onSaved={handleCellSave} placeholder="—" mono />
                      </td>

                      {/* Product */}
                      <td className="px-2 py-2 overflow-hidden">
                        <EditableCell value={s.product} shipmentId={s.id} field="product" onSaved={handleCellSave} placeholder="—" />
                      </td>

                      {/* Supplier */}
                      <td className="px-2 py-2 overflow-hidden">
                        <EditableCell value={s.supplier} shipmentId={s.id} field="supplier" onSaved={handleCellSave} placeholder="—" />
                      </td>

                      {/* Loading (date picker) — show loading_date, or fall back to first load event */}
                      <td className="px-2 py-2">
                        <DateCell value={s.loading_date ?? getLoadingDateISO(s)} shipmentId={s.id} field="loading_date" onSaved={handleCellSave} />
                      </td>

                      {/* ETA (date picker) — show eta_override, or fall back to tracking_eta */}
                      <td className="px-2 py-2">
                        <DateCell value={s.eta_override ?? (s.tracking_eta ? s.tracking_eta.slice(0, 10) : null)} shipmentId={s.id} field="eta_override" onSaved={handleCellSave} />
                      </td>

                      {/* Origin */}
                      <td className="px-2 py-2 truncate" title={getOrigin(s)}>{getOrigin(s)}</td>

                      {/* Destination */}
                      <td className="px-2 py-2 truncate" title={getDestination(s)}>{getDestination(s)}</td>

                      {/* Booking/Container */}
                      <td className="px-2 py-2 truncate">
                        <Link href={`/dashboard/shipments/${s.id}`} className="font-mono font-semibold hover:text-[#00A082] transition">
                          {s.container_number}
                        </Link>
                        {s.sealine_scac && <span className="text-[9px] text-[var(--color-fz-text-muted)] ml-1">{s.sealine_scac}</span>}
                      </td>

                      {/* Company */}
                      <td className="px-2 py-2 overflow-hidden">
                        <EditableCell value={s.company} shipmentId={s.id} field="company" onSaved={handleCellSave} placeholder="—" />
                      </td>
                    </tr>

                    {/* Update note row */}
                    <tr className={`transition border-l-[3px] ${getRowColors(getRowStatus(s)).borderL} ${getRowColors(getRowStatus(s)).bg}`}>
                      <td colSpan={10} className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          {statusChip(s.tracking_status)}
                          {getCurrentLocation(s) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#007AFF] shrink-0">
                              <Navigation size={9} /> {getCurrentLocation(s)}
                            </span>
                          )}
                          <span className="text-[9px] font-semibold text-[var(--color-fz-text-muted)] uppercase shrink-0">Update:</span>
                          <div className="flex-1">
                            <EditableCell value={s.update_note} shipmentId={s.id} field="update_note" onSaved={handleCellSave} placeholder="Click to add update note..." />
                          </div>
                          {s.tracking_updated_at && (
                            <span className="text-[9px] text-[var(--color-fz-text-muted)] shrink-0">
                              {timeAgo(s.tracking_updated_at)}
                            </span>
                          )}
                          <button onClick={() => handleRefresh(s)} disabled={refreshingId === s.id}
                            className="btn-ghost p-1 shrink-0" title="Refresh tracking">
                            <RefreshCw size={11} className={refreshingId === s.id ? 'animate-spin text-[#00A082]' : ''} />
                          </button>
                          <button onClick={() => handleDelete(s)} disabled={deletingId === s.id}
                            className="btn-ghost p-1 text-[#FF4C4C] hover:bg-[#FF4C4C]/10 shrink-0" title="Delete">
                            <Trash2 size={11} className={deletingId === s.id ? 'animate-pulse' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
