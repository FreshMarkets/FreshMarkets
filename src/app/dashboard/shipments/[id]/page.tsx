'use client';

import { useState, useEffect, use } from 'react';
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
} from 'lucide-react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { formatCurrency, timeAgo } from '@/lib/utils';
import type { Shipment, SafeCubeEvent } from '@/types';

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
                <p className="font-semibold truncate">{shipment.origin_contact?.name || '—'}</p>
                <p className="text-xs text-[var(--color-fz-text-muted)]">
                  {shipment.origin_contact?.city}, {shipment.origin_contact?.country}
                </p>
              </div>
              <div className="text-[var(--color-fz-text-muted)] shrink-0">→</div>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-xs text-[var(--color-fz-text-muted)]">Destination</p>
                <p className="font-semibold truncate">{shipment.destination_contact?.name || '—'}</p>
                <p className="text-xs text-[var(--color-fz-text-muted)]">
                  {shipment.destination_contact?.city}, {shipment.destination_contact?.country}
                </p>
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

            {!shipment.container_number ? (
              <div className="text-center py-8 text-[var(--color-fz-text-muted)]">
                <Ship size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No container number set.</p>
                <p className="text-xs mt-1 opacity-70">
                  Add a container / BL / BK number when creating a shipment to enable live tracking.
                </p>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
