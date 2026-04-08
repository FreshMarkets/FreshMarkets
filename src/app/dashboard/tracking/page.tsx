'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Ship,
  Search,
  RefreshCw,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  Calendar,
  Anchor,
  ArrowRight,
  Package,
  Hash,
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

function trackingStatusColor(status: string | null) {
  switch (status) {
    case 'IN_TRANSIT':
      return 'text-[#00A082] bg-[#00A082]/10 border-[#00A082]/20';
    case 'DELIVERED':
      return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
    default:
      return 'text-[var(--color-fz-text-muted)] bg-[var(--color-fz-surface-2)] border-[var(--color-fz-border)]';
  }
}

function trackingStatusIcon(status: string | null) {
  switch (status) {
    case 'IN_TRANSIT':
      return <Ship size={14} />;
    case 'DELIVERED':
      return <CheckCircle2 size={14} />;
    default:
      return <Circle size={14} />;
  }
}

// ---- Quick-Track Section ----

function QuickTrack({ onTracked }: { onTracked: () => void }) {
  const [containerNumber, setContainerNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    eta: string | null;
    events: SafeCubeEvent[];
    vessel: string | null;
    route: { pol: string | null; pod: string | null };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async () => {
    const num = containerNumber.trim().toUpperCase();
    if (!num) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/tracking/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ container_number: num }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tracking lookup failed');
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const events = result?.events
    ? [...result.events].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )
    : [];

  return (
    <div className="glass-card p-6 space-y-5">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Search size={15} className="text-[#00A082]" /> Quick Track
      </h3>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Hash
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-fz-text-muted)]"
          />
          <input
            type="text"
            placeholder="Enter container, BL, or booking number..."
            className="input font-mono"
            style={{ paddingLeft: '3.25rem' }}
            value={containerNumber}
            onChange={(e) => setContainerNumber(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleTrack()}
          />
        </div>
        <button
          onClick={handleTrack}
          disabled={loading || !containerNumber.trim()}
          className="btn-primary shrink-0"
        >
          {loading ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          {loading ? 'Tracking...' : 'Track'}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 text-xs text-[#D93636]">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 animate-fade-in-up animate-fade-in-up-1">
          {/* Status header */}
          <div className="flex items-center gap-4 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${trackingStatusColor(result.status)}`}
            >
              {trackingStatusIcon(result.status)} {result.status}
            </span>
            {result.eta && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-fz-text-secondary)]">
                <Calendar size={14} className="text-[#00A082]" />
                ETA{' '}
                <strong>
                  {new Date(result.eta).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </strong>
              </div>
            )}
            {result.vessel && (
              <div className="flex items-center gap-1.5 text-sm text-[var(--color-fz-text-muted)]">
                <Anchor size={14} /> {result.vessel}
              </div>
            )}
          </div>

          {/* Route */}
          {(result.route.pol || result.route.pod) && (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-[var(--color-fz-text-muted)]" />
                <span>{result.route.pol || '—'}</span>
              </div>
              <ArrowRight size={14} className="text-[var(--color-fz-text-muted)]" />
              <div className="flex items-center gap-1.5">
                <MapPin size={14} className="text-[#00A082]" />
                <span>{result.route.pod || '—'}</span>
              </div>
            </div>
          )}

          {/* Events timeline */}
          {events.length > 0 && (
            <div className="space-y-0 max-h-72 overflow-y-auto pr-1">
              {events.map((ev, i) => (
                <div key={i} className="relative pl-5 pb-4">
                  {i < events.length - 1 && (
                    <span className="absolute left-[5px] top-3 bottom-0 w-px bg-[var(--color-fz-border)]" />
                  )}
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
                      <p className="text-[10px] text-[var(--color-fz-text-muted)]">
                        {ev.facility}
                      </p>
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
      )}
    </div>
  );
}

// ---- Tracked Shipments List ----

export default function TrackingPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const fetchTrackedShipments = () => {
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    supabase
      .from('shipments')
      .select(
        `*, origin_contact:contacts!origin_contact_id(name, city, country),
             destination_contact:contacts!destination_contact_id(name, city, country)`,
      )
      .not('container_number', 'is', null)
      .order('tracking_updated_at', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        if (data) setShipments(data as Shipment[]);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrackedShipments();
  }, []);

  const handleRefresh = async (shipment: Shipment) => {
    setRefreshingId(shipment.id);
    try {
      const res = await fetch(`/api/shipments/${shipment.id}/track`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setShipments((prev) =>
          prev.map((s) =>
            s.id === shipment.id
              ? {
                  ...s,
                  tracking_status: data.tracking_status,
                  tracking_eta: data.tracking_eta,
                  tracking_updated_at: data.tracking_updated_at,
                  tracking_events: data.tracking_events,
                }
              : s,
          ),
        );
      }
    } finally {
      setRefreshingId(null);
    }
  };

  const handleRefreshAll = async () => {
    for (const s of shipments) {
      await handleRefresh(s);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up animate-fade-in-up-1">
        <div>
          <h1 className="text-2xl font-bold">Container Tracking</h1>
          <p className="text-sm text-[var(--color-fz-text-muted)]">
            {loading
              ? 'Loading...'
              : `${shipments.length} tracked containers`}
          </p>
        </div>
        {shipments.length > 0 && (
          <button onClick={handleRefreshAll} className="btn-secondary">
            <RefreshCw size={16} />
            Refresh All
          </button>
        )}
      </div>

      {/* Quick Track */}
      <div className="animate-fade-in-up animate-fade-in-up-2">
        <QuickTrack onTracked={fetchTrackedShipments} />
      </div>

      {/* Tracked Shipments */}
      {loading && (
        <div className="text-center py-16 text-[var(--color-fz-text-muted)]">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin" />
          Loading tracked shipments...
        </div>
      )}

      {!loading && shipments.length === 0 && (
        <div className="text-center py-16">
          <Ship size={40} className="mx-auto text-[var(--color-fz-text-muted)] mb-4" />
          <p className="text-[var(--color-fz-text-muted)]">
            No tracked shipments yet.
          </p>
          <p className="text-xs text-[var(--color-fz-text-muted)] mt-1">
            Add a container number to a shipment or use Quick Track above.
          </p>
        </div>
      )}

      {!loading && shipments.length > 0 && (
        <div className="space-y-3 animate-fade-in-up animate-fade-in-up-3">
          {shipments.map((shipment) => {
            const events: SafeCubeEvent[] = Array.isArray(
              shipment.tracking_events,
            )
              ? [...shipment.tracking_events].sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
                )
              : [];
            const latestEvent = events[0] ?? null;

            return (
              <div key={shipment.id} className="glass-card p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Left: container info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-[#00A082]/10 flex items-center justify-center text-[#00A082] shrink-0">
                      <Ship size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm">
                          {shipment.container_number}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${trackingStatusColor(shipment.tracking_status)}`}
                        >
                          {trackingStatusIcon(shipment.tracking_status)}{' '}
                          {shipment.tracking_status ?? 'UNKNOWN'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--color-fz-text-muted)] mt-0.5">
                        <Link
                          href={`/dashboard/shipments/${shipment.id}`}
                          className="hover:text-[#00A082] transition"
                        >
                          {shipment.reference}
                        </Link>
                        <span>·</span>
                        <span className="truncate">
                          {shipment.description}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Route */}
                  <div className="flex items-center gap-2 text-sm text-[var(--color-fz-text-secondary)] shrink-0">
                    <div className="flex items-center gap-1.5">
                      <MapPin
                        size={14}
                        className="text-[var(--color-fz-text-muted)]"
                      />
                      <span>
                        {shipment.origin_contact?.city || '—'}
                      </span>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-[var(--color-fz-text-muted)]"
                    />
                    <div className="flex items-center gap-1.5">
                      <MapPin size={14} className="text-[#00A082]" />
                      <span>
                        {shipment.destination_contact?.city || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Right: ETA + actions */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      {shipment.tracking_eta && (
                        <p className="text-xs font-medium text-[#00A082]">
                          ETA{' '}
                          {new Date(
                            shipment.tracking_eta,
                          ).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                      {latestEvent && (
                        <p className="text-[10px] text-[var(--color-fz-text-muted)]">
                          {EVENT_CODE_LABELS[latestEvent.eventCode] ??
                            latestEvent.eventCode}{' '}
                          · {latestEvent.location?.name ?? ''}
                        </p>
                      )}
                      {shipment.tracking_updated_at && (
                        <p className="text-[10px] text-[var(--color-fz-text-muted)]">
                          Updated {timeAgo(shipment.tracking_updated_at)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRefresh(shipment)}
                      disabled={refreshingId === shipment.id}
                      className="btn-ghost p-2"
                      title="Refresh tracking"
                    >
                      <RefreshCw
                        size={14}
                        className={
                          refreshingId === shipment.id ? 'animate-spin' : ''
                        }
                      />
                    </button>
                    <Link
                      href={`/dashboard/shipments/${shipment.id}`}
                      className="btn-ghost p-2"
                      title="View shipment"
                    >
                      <Package size={14} />
                    </Link>
                  </div>
                </div>

                {/* Compact timeline — last 3 events */}
                {events.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-fz-border)] flex items-center gap-4 overflow-x-auto">
                    {events.slice(0, 4).map((ev, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[10px] shrink-0"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            ev.isActual
                              ? 'bg-[#00A082]'
                              : 'bg-[var(--color-fz-border)]'
                          }`}
                        />
                        <span className="font-semibold text-[var(--color-fz-text-secondary)]">
                          {EVENT_CODE_LABELS[ev.eventCode] ?? ev.eventCode}
                        </span>
                        <span className="text-[var(--color-fz-text-muted)]">
                          {ev.location?.name ?? ''}
                        </span>
                        <span className="text-[var(--color-fz-text-muted)]">
                          {new Date(ev.date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                        {i < Math.min(events.length - 1, 3) && (
                          <ArrowRight
                            size={10}
                            className="text-[var(--color-fz-border)]"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
