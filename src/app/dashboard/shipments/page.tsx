'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Search,
  ArrowRight,
  Truck,
  MapPin,
  Weight,
  RefreshCw,
  Ship,
  CheckCircle2,
} from 'lucide-react';
import { formatCurrency, timeAgo } from '@/lib/utils';
import type { Shipment, ShipmentStatus } from '@/types';

const STATUS_FILTERS: { label: string; value: ShipmentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending_approval' },
  { label: 'Sent', value: 'sent' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Delivered', value: 'delivered' },
];

function statusBadgeClass(status: ShipmentStatus) {
  switch (status) {
    case 'confirmed':
    case 'delivered':
      return 'badge-success';
    case 'sent':
      return 'badge-info';
    case 'pending_approval':
      return 'badge-warning';
    case 'draft':
      return 'badge-neutral';
    default:
      return 'badge-neutral';
  }
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ShipmentStatus | 'all'>('all');

  useEffect(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);

    fetch(`/api/shipments?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setShipments(data);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const filtered = shipments.filter((s) =>
    s.reference.toLowerCase().includes(search.toLowerCase()) ||
    s.description.toLowerCase().includes(search.toLowerCase()),
  );

  const pendingCount = shipments.filter((s) => s.status === 'pending_approval').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up animate-fade-in-up-1">
        <div>
          <h1 className="text-2xl font-bold">Shipments</h1>
          <p className="text-sm text-[var(--color-fz-text-muted)]">
            {loading ? 'Loading...' : `${filtered.length} shipments · ${pendingCount} pending approval`}
          </p>
        </div>
        <Link href="/dashboard/shipments/new" className="btn-primary">
          <Plus size={16} />
          New Shipment
        </Link>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up animate-fade-in-up-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-fz-text-muted)]"
          />
          <input
            type="text"
            placeholder="Search by reference or description..."
            className="input"
            style={{ paddingLeft: '3.25rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                statusFilter === f.value
                  ? 'bg-[#00A082]/12 text-[#00A082] border border-[#00A082]/30'
                  : 'bg-[var(--color-fz-surface-2)] text-[var(--color-fz-text-muted)] border border-transparent hover:border-[var(--color-fz-border)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-[var(--color-fz-text-muted)]">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin" />
          Loading shipments...
        </div>
      )}

      {/* Shipment Cards */}
      {!loading && (
        <div className="space-y-4">
          {filtered.map((shipment, i) => (
            <Link
              key={shipment.id}
              href={`/dashboard/shipments/${shipment.id}`}
              className={`glass-card p-6 block group animate-fade-in-up animate-fade-in-up-${Math.min(i + 2, 6)}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Left: Icon + Reference */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#00A082]/10 flex items-center justify-center text-[#00A082] shrink-0">
                    <Package size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{shipment.reference}</span>
                      <span className={`badge text-xs ${statusBadgeClass(shipment.status)}`}>
                        {shipment.status.replace('_', ' ')}
                      </span>
                      {shipment.tracking_status === 'IN_TRANSIT' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#00A082]/10 text-[#00A082] border border-[#00A082]/20">
                          <Ship size={10} />
                          IN TRANSIT
                        </span>
                      )}
                      {shipment.tracking_status === 'DELIVERED' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <CheckCircle2 size={10} />
                          DELIVERED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-fz-text-muted)] truncate mt-0.5">
                      {shipment.description}
                    </p>
                    {shipment.tracking_eta && (
                      <p className="text-xs text-[#00A082] mt-0.5 font-medium">
                        ETA {new Date(shipment.tracking_eta).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Middle: Route */}
                <div className="flex items-center gap-2 text-sm text-[var(--color-fz-text-secondary)] shrink-0">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-[var(--color-fz-text-muted)]" />
                    <span>{shipment.origin_contact?.city || '—'}</span>
                  </div>
                  <ArrowRight size={14} className="text-[var(--color-fz-text-muted)]" />
                  <div className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-[#00A082]" />
                    <span>{shipment.destination_contact?.city || '—'}</span>
                  </div>
                </div>

                {/* Right: Meta */}
                <div className="flex items-center gap-6 text-sm shrink-0">
                  {shipment.carrier && (
                    <div className="flex items-center gap-1.5 text-[var(--color-fz-text-secondary)]">
                      <Truck size={14} className="text-[var(--color-fz-text-muted)]" />
                      <span className="hidden lg:inline">{shipment.carrier.name}</span>
                    </div>
                  )}
                  {shipment.weight_kg && (
                    <div className="flex items-center gap-1 text-[var(--color-fz-text-muted)]">
                      <Weight size={14} />
                      <span>{shipment.weight_kg.toLocaleString()} kg</span>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="font-semibold">
                      {shipment.value_usd
                        ? formatCurrency(shipment.value_usd, shipment.currency)
                        : '—'}
                    </div>
                    <div className="text-xs text-[var(--color-fz-text-muted)]">
                      {timeAgo(shipment.created_at)}
                    </div>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-[var(--color-fz-text-muted)] group-hover:text-[#00A082] transition hidden sm:block"
                  />
                </div>
              </div>
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Package size={40} className="mx-auto text-[var(--color-fz-text-muted)] mb-4" />
              <p className="text-[var(--color-fz-text-muted)]">No shipments found.</p>
              <Link href="/dashboard/shipments/new" className="btn-primary mt-4 inline-flex">
                <Plus size={16} />
                Create your first shipment
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
