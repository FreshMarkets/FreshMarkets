'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Eye,
  Search,
  RefreshCw,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { EmailDraft, DraftStatus } from '@/types';

const STATUS_TABS: { label: string; value: DraftStatus | 'all'; icon: React.ElementType }[] = [
  { label: 'All', value: 'all', icon: Mail },
  { label: 'Drafts', value: 'draft', icon: FileText },
  { label: 'Pending', value: 'pending_approval', icon: Clock },
  { label: 'Sent', value: 'sent', icon: Send },
];

function statusIcon(status: DraftStatus) {
  switch (status) {
    case 'sent':
      return <CheckCircle size={14} className="text-[#00A082]" />;
    case 'pending_approval':
      return <Clock size={14} className="text-[#B8860B]" />;
    case 'approved':
      return <CheckCircle size={14} className="text-[#4A90D9]" />;
    case 'rejected':
      return <XCircle size={14} className="text-[#D93636]" />;
    default:
      return <FileText size={14} className="text-[var(--color-fz-text-muted)]" />;
  }
}

function statusBadge(status: DraftStatus) {
  switch (status) {
    case 'sent':
      return 'badge-success';
    case 'pending_approval':
      return 'badge-warning';
    case 'approved':
      return 'badge-info';
    case 'rejected':
      return 'badge-error';
    default:
      return 'badge-neutral';
  }
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<DraftStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/emails')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setEmails(data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = emails.filter((e) => {
    const matchSearch =
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      e.recipient_email.toLowerCase().includes(search.toLowerCase());
    const matchTab = tab === 'all' || e.status === tab;
    return matchSearch && matchTab;
  });

  const selected = selectedId ? emails.find((e) => e.id === selectedId) : null;
  const pendingCount = emails.filter((e) => e.status === 'pending_approval').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in-up animate-fade-in-up-1">
        <h1 className="text-2xl font-bold">Email Drafts</h1>
        <p className="text-sm text-[var(--color-fz-text-muted)]">
          {loading ? 'Loading...' : `${emails.length} total · ${pendingCount} awaiting approval`}
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up animate-fade-in-up-2">
        <div className="flex items-center gap-2">
          {STATUS_TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                  tab === t.value
                    ? 'bg-[#00A082]/12 text-[#00A082] border border-[#00A082]/30'
                    : 'bg-[var(--color-fz-surface-2)] text-[var(--color-fz-text-muted)] border border-transparent hover:border-[var(--color-fz-border)]'
                }`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-fz-text-muted)]"
          />
          <input
            type="text"
            placeholder="Search emails..."
            className="input"
            style={{ paddingLeft: '3.25rem' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16 text-[var(--color-fz-text-muted)]">
          <RefreshCw size={24} className="mx-auto mb-3 animate-spin" />
          Loading emails...
        </div>
      )}

      {/* Split view */}
      {!loading && (
        <div className="grid lg:grid-cols-5 gap-6 animate-fade-in-up animate-fade-in-up-3">
          {/* Email list */}
          <div className="lg:col-span-2 space-y-2">
            {filtered.map((email) => (
              <button
                key={email.id}
                onClick={() => setSelectedId(email.id)}
                className={`w-full text-left glass-card p-4 transition ${
                  selectedId === email.id
                    ? 'border-[#00A082]/40 bg-[#00A082]/5'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {statusIcon(email.status)}
                    <span className="text-sm font-medium truncate flex-1">
                      {email.recipient_email}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-fz-text-muted)] shrink-0">
                    {timeAgo(email.created_at)}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-fz-text-secondary)] truncate">
                  {email.subject}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`badge text-xs ${statusBadge(email.status)}`}>
                    {email.status.replace('_', ' ')}
                  </span>
                  <span className="badge badge-neutral text-xs">{email.draft_type}</span>
                </div>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-[var(--color-fz-text-muted)]">
                <Mail size={32} className="mx-auto mb-3" />
                <p className="text-sm">No emails match your search.</p>
              </div>
            )}
          </div>

          {/* Email preview */}
          <div className="lg:col-span-3">
            {selected ? (
              <div className="glass-card p-6 sticky top-24 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcon(selected.status)}
                    <span className={`badge text-xs ${statusBadge(selected.status)}`}>
                      {selected.status.replace('_', ' ')}
                    </span>
                    <span className="badge badge-neutral text-xs">
                      {selected.generated_by === 'claude' ? '✨ AI Generated' : selected.generated_by}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--color-fz-text-muted)]">
                    {timeAgo(selected.created_at)}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[var(--color-fz-text-muted)]">To</label>
                    <p className="text-sm">{selected.recipient_email}</p>
                  </div>
                  {selected.cc_emails.length > 0 && (
                    <div>
                      <label className="text-xs text-[var(--color-fz-text-muted)]">CC</label>
                      <p className="text-sm">{selected.cc_emails.join(', ')}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-[var(--color-fz-text-muted)]">Subject</label>
                    <p className="text-sm font-medium">{selected.subject}</p>
                  </div>
                </div>

                <div className="border-t border-[var(--color-fz-border)] pt-4">
                  <pre className="text-sm text-[var(--color-fz-text-secondary)] whitespace-pre-wrap font-sans leading-relaxed">
                    {selected.body}
                  </pre>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-[var(--color-fz-border)]">
                  {selected.status === 'draft' && (
                    <>
                      <button className="btn-primary flex-1 justify-center">
                        <Send size={14} />
                        Send via Gmail
                      </button>
                      <button className="btn-secondary">Edit</button>
                    </>
                  )}
                  {selected.status === 'pending_approval' && (
                    <>
                      <button className="btn-primary flex-1 justify-center">
                        <CheckCircle size={14} />
                        Approve
                      </button>
                      <button className="btn-secondary text-[#D93636]">
                        <XCircle size={14} />
                        Reject
                      </button>
                    </>
                  )}
                  {selected.status === 'sent' && (
                    <div className="text-sm text-[var(--color-fz-text-muted)] flex items-center gap-2">
                      <CheckCircle size={14} className="text-[#00A082]" />
                      Sent {selected.sent_at ? timeAgo(selected.sent_at) : ''}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="glass-card p-12 text-center text-[var(--color-fz-text-muted)] sticky top-24">
                <Eye size={40} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">Select an email to preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
