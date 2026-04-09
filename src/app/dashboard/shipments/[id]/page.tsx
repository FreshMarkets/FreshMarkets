'use client';

import { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Package,
  MapPin,
  Truck,
  Weight,
  FileText,
  Ship,
  RefreshCw,
  CheckCircle2,
  Clock,
  Circle,
  Download,
  Calendar,
  Hash,
  Pencil,
  Check,
  Navigation,
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { formatCurrency, timeAgo } from '@/lib/utils';
import type { Shipment, SafeCubeEvent } from '@/types';

// ---- Inline Editable Field ----

function EditableField({
  label, value, shipmentId, field, onSaved, mono,
}: {
  label: string; value: string | null; shipmentId: string; field: string;
  onSaved: (field: string, val: string | null) => void; mono?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = draft.trim() || null;
    if (trimmed === (value ?? null)) return;
    onSaved(field, trimmed);
    try {
      await fetch(`/api/tracking/${shipmentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: trimmed }),
      });
    } catch { onSaved(field, value); }
  };

  return (
    <div>
      <p className="text-[10px] text-[var(--color-fz-text-muted)] mb-1">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <input ref={inputRef}
            className={`flex-1 bg-transparent border-b border-[#00A082] outline-none text-sm py-0.5 ${mono ? 'font-mono' : ''}`}
            value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value ?? ''); setEditing(false); } }}
          />
          <button onClick={save} className="text-[#00A082] p-0.5"><Check size={13} /></button>
        </div>
      ) : (
        <div
          className={`flex items-center gap-1.5 cursor-pointer group/edit ${mono ? 'font-mono' : ''}`}
          onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        >
          <span className={`text-sm ${!value ? 'text-[var(--color-fz-text-muted)] italic' : ''}`}>
            {value || '—'}
          </span>
          <Pencil size={11} className="text-[var(--color-fz-text-muted)] opacity-0 group-hover/edit:opacity-100 transition" />
        </div>
      )}
    </div>
  );
}

// ---- Date Field ----

function DateField({
  label, value, shipmentId, field, onSaved, fallback,
}: {
  label: string; value: string | null; shipmentId: string; field: string;
  onSaved: (field: string, val: string | null) => void; fallback?: string;
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
    onSaved(field, val);
    try {
      await fetch(`/api/tracking/${shipmentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val }),
      });
    } catch { onSaved(field, value); }
  };

  const openPicker = () => {
    inputRef.current?.showPicker?.();
    inputRef.current?.click();
  };

  return (
    <div>
      <p className="text-[10px] text-[var(--color-fz-text-muted)] mb-1">{label}</p>
      <div className="relative">
        <div
          className={`flex items-center gap-1.5 cursor-pointer group/edit`}
          onClick={openPicker}
        >
          <Calendar size={13} className="text-[#00A082] shrink-0" />
          <span className={`text-sm ${value ? 'font-medium' : 'text-[var(--color-fz-text-muted)]'}`}>
            {displayValue}
          </span>
          <Pencil size={11} className="text-[var(--color-fz-text-muted)] opacity-0 group-hover/edit:opacity-100 transition" />
        </div>
        <input
          ref={inputRef} type="date"
          className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
          tabIndex={-1} value={value ?? ''} onChange={handleChange}
        />
      </div>
    </div>
  );
}

// ---- Helpers ----

function statusBadgeClass(status: string) {
  switch (status) {
    case 'confirmed':
    case 'delivered':   return 'badge-success';
    case 'sent':        return 'badge-info';
    case 'pending_approval': return 'badge-warning';
    default:            return 'badge-neutral';
  }
}

function trackingStatusChip(status: string | null) {
  if (!status) return null;
  if (status === 'IN_TRANSIT') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#00A082]/10 text-[#00A082] border border-[#00A082]/20">
        <Ship size={12} /> IN TRANSIT
      </span>
    );
  }
  if (status === 'DELIVERED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
        <CheckCircle2 size={12} /> DELIVERED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--color-fz-surface-2)] text-[var(--color-fz-text-muted)] border border-[var(--color-fz-border)]">
      <Circle size={12} /> {status}
    </span>
  );
}

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

// ---- Track Input (enter container/BL/booking to start tracking) ----

function TrackInput({ shipmentId, currentNumber, onTracked }: { shipmentId: string; currentNumber?: string | null; onTracked: (data: Partial<Shipment>) => void }) {
  const [editing, setEditing] = useState(!currentNumber);
  const [number, setNumber] = useState(currentNumber ?? '');
  const [type, setType] = useState<'CT' | 'BL' | 'BK'>('CT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async () => {
    const num = number.trim().toUpperCase();
    if (!num) return;
    setLoading(true); setError(null);
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.from('shipments').update({ container_number: num }).eq('id', shipmentId);

      const res = await fetch(`/api/shipments/${shipmentId}/track`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tracking failed');
      setEditing(false);
      onTracked({
        container_number: num,
        tracking_status: data.tracking_status,
        tracking_eta: data.tracking_eta,
        tracking_updated_at: data.tracking_updated_at,
        tracking_events: data.tracking_events,
        loading_date: data.loading_date,
        eta_override: data.eta_override,
      });
    } catch (err) { setError(String(err)); } finally { setLoading(false); }
  };

  if (!editing && currentNumber) {
    return (
      <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-[var(--color-fz-surface-2)]">
        <Hash size={13} className="text-[var(--color-fz-text-muted)] shrink-0" />
        <span className="font-mono text-sm font-semibold flex-1 truncate">{currentNumber}</span>
        <button onClick={() => { setNumber(currentNumber); setEditing(true); }} className="btn-ghost text-[10px] py-0.5 px-2 shrink-0">
          <Pencil size={11} /> Change
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-4">
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as 'CT' | 'BL' | 'BK')}
          className="input w-auto px-2 text-xs font-medium shrink-0"
        >
          <option value="CT">Container</option>
          <option value="BL">Bill of Lading</option>
          <option value="BK">Booking</option>
        </select>
        <div className="relative flex-1">
          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-fz-text-muted)]" />
          <input
            type="text"
            placeholder={type === 'CT' ? 'Container number...' : type === 'BL' ? 'BL number...' : 'Booking number...'}
            className="input font-mono text-sm w-full"
            style={{ paddingLeft: '2.25rem' }}
            value={number}
            onChange={(e) => setNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={handleTrack} disabled={loading || !number.trim()} className="btn-primary flex-1 text-sm">
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Ship size={14} />}
          {loading ? 'Tracking...' : 'Start Tracking'}
        </button>
        {currentNumber && (
          <button onClick={() => setEditing(false)} className="btn-ghost text-xs px-3">Cancel</button>
        )}
      </div>
      {error && <p className="text-xs text-[#D93636] bg-[#FF4C4C]/10 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );
}

// ---- Main page ----

export default function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase
      .from('shipments')
      .select(`
        *,
        origin_contact:contacts!origin_contact_id(*),
        destination_contact:contacts!destination_contact_id(*),
        carrier:contacts!carrier_id(*)
      `)
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setShipment(data as Shipment);
        setLoading(false);
      });
  }, [id]);

  const handleRefreshTracking = async () => {
    setRefreshing(true);
    setTrackingError(null);
    try {
      const res = await fetch(`/api/shipments/${id}/track`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tracking refresh failed');
      setShipment((prev) =>
        prev
          ? {
              ...prev,
              tracking_status: data.tracking_status,
              tracking_eta: data.tracking_eta,
              tracking_updated_at: data.tracking_updated_at,
              tracking_events: data.tracking_events,
              loading_date: data.loading_date ?? prev.loading_date,
              eta_override: data.eta_override ?? prev.eta_override,
            }
          : prev,
      );
    } catch (err) {
      setTrackingError(String(err));
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--color-fz-text-muted)]">
        <RefreshCw size={20} className="animate-spin mr-2" /> Loading shipment...
      </div>
    );
  }

  if (!shipment) {
    return (
      <div className="text-center py-24">
        <Package size={40} className="mx-auto text-[var(--color-fz-text-muted)] mb-4" />
        <p className="text-[var(--color-fz-text-muted)]">Shipment not found.</p>
        <Link href="/dashboard/shipments" className="btn-primary mt-4 inline-flex">
          <ArrowLeft size={16} /> Back to Shipments
        </Link>
      </div>
    );
  }

  const handleFieldSave = (field: string, val: string | null) => {
    setShipment((prev) => prev ? { ...prev, [field]: val } : prev);
  };

  // Route autofill from tracking events
  const getOriginFromTracking = () => {
    const evts = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];
    const sorted = [...evts].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sorted[0];
    if (first?.location?.name) return { name: first.location.name, detail: first.location.country ?? '' };
    return null;
  };

  const getDestinationFromTracking = () => {
    const evts = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];
    const estimated = evts.filter((e) => !e.isActual).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = estimated[0];
    if (last?.location?.name) return { name: last.location.name, detail: last.location.country ?? '' };
    return null;
  };

  const originName = shipment.origin_contact?.name || getOriginFromTracking()?.name || '—';
  const originDetail = shipment.origin_contact ? `${shipment.origin_contact.city}, ${shipment.origin_contact.country}` : getOriginFromTracking()?.detail || '';
  const destName = shipment.destination_contact?.name || getDestinationFromTracking()?.name || '—';
  const destDetail = shipment.destination_contact ? `${shipment.destination_contact.city}, ${shipment.destination_contact.country}` : getDestinationFromTracking()?.detail || '';

  const getLoadingDateFallback = () => {
    const evts = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];
    const loadEvent = evts.find((e) => e.isActual && e.eventCode === 'LDND')
      ?? evts.find((e) => e.isActual && e.eventCode === 'DEPA')
      ?? evts.find((e) => e.isActual && e.eventCode === 'GTOT');
    if (loadEvent) return new Date(loadEvent.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return undefined;
  };

  const getEtaFallback = () => {
    if (shipment.tracking_eta) return new Date(shipment.tracking_eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return undefined;
  };

  const getCurrentLocation = () => {
    const evts = Array.isArray(shipment.tracking_events) ? shipment.tracking_events : [];
    const actual = [...evts].filter((e) => e.isActual).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latest = actual[0];
    if (latest?.location?.name) return `${latest.location.name}${latest.location.country ? ', ' + latest.location.country : ''}`;
    return null;
  };

  const currentLocation = getCurrentLocation();

  const events: SafeCubeEvent[] = Array.isArray(shipment.tracking_events)
    ? [...shipment.tracking_events].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 animate-fade-in-up animate-fade-in-up-1">
        <Link href="/dashboard/shipments" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold font-mono">{shipment.reference}</h1>
            <span className={`badge ${statusBadgeClass(shipment.status)}`}>
              {shipment.status.replace('_', ' ')}
            </span>
            {trackingStatusChip(shipment.tracking_status)}
            {currentLocation && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#007AFF]">
                <Navigation size={11} /> {currentLocation}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-fz-text-muted)] mt-0.5 truncate">
            {shipment.description}
          </p>
        </div>
        <a
          href={`/api/shipments/${id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary shrink-0"
        >
          <Download size={15} />
          PDF
        </a>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Shipment details */}
        <div className="lg:col-span-3 space-y-4 animate-fade-in-up animate-fade-in-up-2">

          {/* Route */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <MapPin size={15} className="text-[#FF9500]" /> Route
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--color-fz-text-muted)]">Origin</p>
                <p className="font-semibold truncate">{originName}</p>
                {originDetail && <p className="text-xs text-[var(--color-fz-text-muted)]">{originDetail}</p>}
              </div>
              <div className="text-[var(--color-fz-text-muted)] shrink-0">→</div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs text-[var(--color-fz-text-muted)]">Destination</p>
                <p className="font-semibold truncate">{destName}</p>
                {destDetail && <p className="text-xs text-[var(--color-fz-text-muted)]">{destDetail}</p>}
              </div>
            </div>
            {shipment.carrier && (
              <div className="mt-4 pt-4 border-t border-[var(--color-fz-border)] flex items-center gap-2 text-sm text-[var(--color-fz-text-secondary)]">
                <Truck size={14} className="text-[var(--color-fz-text-muted)]" />
                {shipment.carrier.name}
              </div>
            )}
          </div>

          {/* Goods */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Package size={15} className="text-[#00A082]" /> Goods
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {shipment.product && (
                <div className="col-span-2 font-semibold text-[var(--color-fz-text)]">
                  {shipment.product}
                </div>
              )}
              {shipment.weight_kg && (
                <div className="flex items-center gap-2 text-[var(--color-fz-text-secondary)]">
                  <Weight size={14} className="text-[var(--color-fz-text-muted)]" />
                  {shipment.weight_kg.toLocaleString()} kg
                </div>
              )}
              {shipment.value_usd && (
                <div className="font-semibold">
                  {formatCurrency(shipment.value_usd, shipment.currency)}
                </div>
              )}
              {shipment.hs_code && (
                <div className="text-[var(--color-fz-text-muted)]">HS {shipment.hs_code}</div>
              )}
              {shipment.incoterm && (
                <div className="text-[var(--color-fz-text-muted)]">{shipment.incoterm}</div>
              )}
            </div>
            {shipment.special_handling && (
              <p className="mt-3 text-xs text-[var(--color-fz-text-muted)] border-t border-[var(--color-fz-border)] pt-3">
                {shipment.special_handling}
              </p>
            )}
          </div>

          {/* Tracking Details (editable, synced with tracking table) */}
          <div className="glass-card p-6">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <FileText size={15} className="text-[#007AFF]" /> Tracking Details
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <EditableField label="PO Number" value={shipment.po_number} shipmentId={shipment.id} field="po_number" onSaved={handleFieldSave} mono />
              <EditableField label="Product" value={shipment.product} shipmentId={shipment.id} field="product" onSaved={handleFieldSave} />
              <EditableField label="Supplier" value={shipment.supplier} shipmentId={shipment.id} field="supplier" onSaved={handleFieldSave} />
              <EditableField label="Company" value={shipment.company} shipmentId={shipment.id} field="company" onSaved={handleFieldSave} />
              <DateField label="Loading Date" value={shipment.loading_date} shipmentId={shipment.id} field="loading_date" onSaved={handleFieldSave} fallback={getLoadingDateFallback()} />
              <DateField label="ETA Override" value={shipment.eta_override} shipmentId={shipment.id} field="eta_override" onSaved={handleFieldSave} fallback={getEtaFallback()} />
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-fz-border)]">
              <EditableField label="Update Note" value={shipment.update_note} shipmentId={shipment.id} field="update_note" onSaved={handleFieldSave} />
            </div>
          </div>

          {/* Meta */}
          <div className="glass-card p-4 flex items-center gap-6 text-xs text-[var(--color-fz-text-muted)]">
            <span className="flex items-center gap-1.5">
              <FileText size={13} />
              Created {timeAgo(shipment.created_at)}
            </span>
            {shipment.container_number && (
              <span className="flex items-center gap-1.5 font-mono">
                <Hash size={13} />
                {shipment.container_number}
                {shipment.sealine_scac && ` · ${shipment.sealine_scac}`}
              </span>
            )}
          </div>
        </div>

        {/* Right: Tracking panel */}
        <div className="lg:col-span-2 animate-fade-in-up animate-fade-in-up-3">
          <div className="glass-card p-6 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Ship size={15} className="text-[#00A082]" /> Container Tracking
              </h3>
              {shipment.container_number && (
                <button
                  onClick={handleRefreshTracking}
                  disabled={refreshing}
                  className="btn-ghost text-xs py-1 px-2"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              )}
            </div>

            {/* Track input — always visible */}
            <TrackInput
              shipmentId={shipment.id}
              currentNumber={shipment.container_number}
              onTracked={(updated) => setShipment((prev) => prev ? { ...prev, ...updated } : prev)}
            />

            {shipment.container_number ? (
              <div className="space-y-4">
                {/* Status + ETA */}
                <div className="space-y-2">
                  {trackingStatusChip(shipment.tracking_status)}
                  {shipment.tracking_eta && (
                    <div className="flex items-center gap-2 text-sm text-[var(--color-fz-text-secondary)]">
                      <Calendar size={14} className="text-[#00A082]" />
                      <span>
                        ETA{' '}
                        <strong>
                          {new Date(shipment.tracking_eta).toLocaleDateString('en-GB', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </strong>
                      </span>
                    </div>
                  )}
                  {shipment.tracking_updated_at && (
                    <p className="text-[10px] text-[var(--color-fz-text-muted)]">
                      Updated {timeAgo(shipment.tracking_updated_at)}
                    </p>
                  )}
                </div>

                {trackingError && (
                  <div className="px-3 py-2 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 text-xs text-[#D93636]">
                    {trackingError}
                  </div>
                )}

                {/* Events timeline */}
                {events.length === 0 ? (
                  <div className="text-center py-6 text-[var(--color-fz-text-muted)]">
                    <Clock size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">No events yet. Click Refresh to fetch live data.</p>
                  </div>
                ) : (
                  <div className="space-y-0 max-h-80 overflow-y-auto pr-1">
                    {events.map((ev, i) => (
                      <div key={i} className="relative pl-5 pb-4">
                        {/* Timeline line */}
                        {i < events.length - 1 && (
                          <span className="absolute left-[5px] top-3 bottom-0 w-px bg-[var(--color-fz-border)]" />
                        )}
                        {/* Dot */}
                        <span
                          className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 ${
                            ev.isActual
                              ? 'bg-[#00A082] border-[#00A082]'
                              : 'bg-transparent border-[var(--color-fz-border)]'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-[var(--color-fz-text)]">
                              {EVENT_CODE_LABELS[ev.eventCode] ?? ev.eventCode}
                            </span>
                            {!ev.isActual && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--color-fz-surface-2)] text-[var(--color-fz-text-muted)] border border-[var(--color-fz-border)]">
                                EST
                              </span>
                            )}
                          </div>
                          {ev.location?.name && (
                            <p className="text-xs text-[var(--color-fz-text-muted)] mt-0.5">
                              {ev.location.name}
                              {ev.location.country ? `, ${ev.location.country}` : ''}
                              {ev.location.locode ? ` (${ev.location.locode})` : ''}
                            </p>
                          )}
                          {ev.facility && (
                            <p className="text-[10px] text-[var(--color-fz-text-muted)]">{ev.facility}</p>
                          )}
                          <p className="text-[10px] text-[var(--color-fz-text-muted)] mt-0.5">
                            {new Date(ev.date).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
