'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, RefreshCw, Filter, MapPin, Mail, Phone } from 'lucide-react';
import type { Contact, ContactType } from '@/types';

const TYPE_FILTERS: { label: string; value: ContactType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Carriers', value: 'carrier' },
  { label: 'Warehouses', value: 'warehouse' },
  { label: 'Brokers', value: 'broker' },
  { label: 'Customers', value: 'customer' },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ContactType | 'all'>('all');
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const fetchContacts = async () => {
    try {
      const res = await fetch('/api/contacts');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setContacts(data);
      }
    } catch {
      // network error — contacts stay empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContacts(); }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/contacts/sync-sheets', { method: 'POST' });
      await fetchContacts();
      setLastSynced(new Date().toLocaleString());
    } finally {
      setSyncing(false);
    }
  };

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.country?.toLowerCase().includes(search.toLowerCase()) ||
      c.city?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in-up animate-fade-in-up-1">
        <div>
          <h1 className="text-2xl font-bold">Contact Directory</h1>
          <p className="text-sm text-[var(--color-fz-text-muted)]">
            {loading ? 'Loading...' : `${filtered.length} contacts`}
          {lastSynced && ` · Last synced ${lastSynced}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSync} className="btn-secondary" disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync from Sheets'}
          </button>
          <button className="btn-primary">
            <Plus size={16} />
            Add Contact
          </button>
        </div>
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
            placeholder="Search by name, email, country..."
            className="input"
            style={{ paddingLeft: '3.25rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition whitespace-nowrap ${
                typeFilter === f.value
                  ? 'bg-[#00A082]/12 text-[#00A082] border border-[#00A082]/30'
                  : 'bg-[var(--color-fz-surface-2)] text-[var(--color-fz-text-muted)] border border-transparent hover:border-[var(--color-fz-border)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact Cards Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading && (
          <div className="col-span-3 text-center py-16 text-[var(--color-fz-text-muted)]">
            <RefreshCw size={24} className="mx-auto mb-3 animate-spin" />
            Loading contacts...
          </div>
        )}
        {!loading && filtered.map((contact, i) => (
          <div
            key={contact.id}
            className={`glass-card p-6 animate-fade-in-up animate-fade-in-up-${Math.min(i + 1, 6)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00A082]/20 to-[#00C49A]/20 flex items-center justify-center text-[#00A082] font-semibold text-sm">
                  {contact.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{contact.name}</h3>
                  <span
                    className={`badge text-xs mt-0.5 ${
                      contact.type === 'carrier'
                        ? 'badge-info'
                        : contact.type === 'warehouse'
                        ? 'bg-[#FF9500]/12 text-[#CC7700]'
                        : contact.type === 'broker'
                        ? 'bg-[#FFC244]/15 text-[#B8860B]'
                        : 'badge-success'
                    }`}
                  >
                    {contact.type}
                  </span>
                </div>
              </div>
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  contact.is_active ? 'bg-[#00A082]' : 'bg-gray-400'
                }`}
                title={contact.is_active ? 'Active' : 'Inactive'}
              />
            </div>

            <div className="space-y-2.5 text-sm text-[var(--color-fz-text-secondary)]">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-[var(--color-fz-text-muted)] shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-[var(--color-fz-text-muted)] shrink-0" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {contact.city && contact.country && (
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[var(--color-fz-text-muted)] shrink-0" />
                  <span>
                    {contact.city}, {contact.country}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--color-fz-border)]">
              <button className="btn-ghost text-xs flex-1">Edit</button>
              <button className="btn-ghost text-xs flex-1 text-[#00A082]">
                <Mail size={14} />
                Email
              </button>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Filter size={40} className="mx-auto text-[var(--color-fz-text-muted)] mb-4" />
          <p className="text-[var(--color-fz-text-muted)]">No contacts match your filters.</p>
        </div>
      )}
    </div>
  );
}
