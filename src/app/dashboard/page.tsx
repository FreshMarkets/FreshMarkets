import {
  Package,
  Mail,
  Users,
  Bot,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase';
import { timeAgo, formatCurrency } from '@/lib/utils';
import Link from 'next/link';

function StatCard({
  icon: Icon,
  label,
  value,
  change,
  accent,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  change?: string;
  accent: string;
  delay: number;
}) {
  return (
    <div
      className={`stat-card animate-fade-in-up animate-fade-in-up-${delay}`}
      style={{ '--accent-color': accent } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--color-fz-text-muted)] mb-1">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {change && (
            <p className="text-xs text-[#00A082] mt-1 flex items-center gap-1">
              <TrendingUp size={12} />
              {change}
            </p>
          )}
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}20`, color: accent }}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const [
    { count: shipmentsThisMonth },
    { count: pendingApprovals },
    { count: emailsSentToday },
    { count: activeContacts },
    { data: recentShipments },
    { data: recentLogs },
  ] = await Promise.all([
    supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfMonth),
    supabase
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_approval'),
    supabase
      .from('email_drafts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', startOfDay),
    supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('shipments')
      .select(`
        *,
        origin_contact:contacts!origin_contact_id(*),
        destination_contact:contacts!destination_contact_id(*),
        carrier:contacts!carrier_id(*)
      `)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('automation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div className="animate-fade-in-up animate-fade-in-up-1">
        <h1 className="text-2xl font-bold mb-1">Overview</h1>
        <p className="text-[var(--color-fz-text-muted)]">
          Here&apos;s what&apos;s happening with your supply chain today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={Package}
          label="Shipments This Month"
          value={shipmentsThisMonth ?? 0}
          accent="#00A082"
          delay={1}
        />
        <StatCard
          icon={AlertCircle}
          label="Pending Approvals"
          value={pendingApprovals ?? 0}
          accent="#FFC244"
          delay={2}
        />
        <StatCard
          icon={Mail}
          label="Emails Sent Today"
          value={emailsSentToday ?? 0}
          accent="#FF9500"
          delay={3}
        />
        <StatCard
          icon={Users}
          label="Active Contacts"
          value={activeContacts ?? 0}
          accent="#4A90D9"
          delay={4}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Shipments */}
        <div className="lg:col-span-2 glass-card animate-fade-in-up animate-fade-in-up-5">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-fz-border)]">
            <h3 className="font-semibold flex items-center gap-2">
              <Package size={18} className="text-[#00A082]" />
              Recent Shipments
            </h3>
            <Link href="/dashboard/shipments" className="text-sm text-[#00A082] hover:text-[#008A6E] transition">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-[var(--color-fz-border)]">
            {(recentShipments ?? []).length === 0 && (
              <p className="px-6 py-8 text-sm text-[var(--color-fz-text-muted)] text-center">
                No shipments yet. <Link href="/dashboard/shipments/new" className="text-[#00A082]">Create one →</Link>
              </p>
            )}
            {(recentShipments ?? []).map((shipment) => (
              <Link
                key={shipment.id}
                href={`/dashboard/shipments/${shipment.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-[rgba(0,160,130,0.03)] transition"
              >
                <div className="w-10 h-10 rounded-xl bg-[#00A082]/10 flex items-center justify-center text-[#00A082] shrink-0">
                  <Package size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{shipment.reference}</span>
                    <span
                      className={`badge text-xs ${
                        shipment.status === 'confirmed'
                          ? 'badge-success'
                          : shipment.status === 'sent'
                          ? 'badge-info'
                          : shipment.status === 'pending_approval'
                          ? 'badge-warning'
                          : 'badge-neutral'
                      }`}
                    >
                      {shipment.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-fz-text-muted)] truncate">
                    {shipment.description}
                  </p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-sm font-medium">
                    {shipment.value_usd ? formatCurrency(shipment.value_usd, shipment.currency) : '—'}
                  </div>
                  <div className="text-xs text-[var(--color-fz-text-muted)]">
                    {timeAgo(shipment.created_at)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card animate-fade-in-up animate-fade-in-up-6">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-fz-border)]">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock size={18} className="text-[#FF9500]" />
              Activity
            </h3>
          </div>
          <div className="px-6 py-3 space-y-4">
            {(recentLogs ?? []).length === 0 && (
              <p className="text-sm text-[var(--color-fz-text-muted)] py-4 text-center">No activity yet.</p>
            )}
            {(recentLogs ?? []).map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    log.status === 'success'
                      ? 'bg-[#00A082]/10 text-[#00A082]'
                      : log.status === 'pending'
                      ? 'bg-[#FFC244]/15 text-[#B8860B]'
                      : 'bg-[#FF4C4C]/10 text-[#D93636]'
                  }`}
                >
                  {log.status === 'success' ? (
                    <CheckCircle size={14} />
                  ) : log.status === 'pending' ? (
                    <Clock size={14} />
                  ) : (
                    <AlertCircle size={14} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm capitalize">
                    {log.event_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-[var(--color-fz-text-muted)]">
                    {timeAgo(log.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-3 gap-4 animate-fade-in-up animate-fade-in-up-6">
        <Link
          href="/dashboard/shipments/new"
          className="glass-card p-6 flex items-center gap-4 hover:border-[#00A082]/30 transition group"
        >
          <div className="w-12 h-12 rounded-xl bg-[#00A082]/10 flex items-center justify-center text-[#00A082] group-hover:scale-110 transition">
            <Package size={22} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">New Shipment</h4>
            <p className="text-xs text-[var(--color-fz-text-muted)]">
              Create &amp; generate emails
            </p>
          </div>
        </Link>
        <Link
          href="/dashboard/ai-assistant"
          className="glass-card p-6 flex items-center gap-4 hover:border-[#FF9500]/30 transition group"
        >
          <div className="w-12 h-12 rounded-xl bg-[#FF9500]/10 flex items-center justify-center text-[#FF9500] group-hover:scale-110 transition">
            <Bot size={22} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">AI Assistant</h4>
            <p className="text-xs text-[var(--color-fz-text-muted)]">
              Describe a shipment in plain English
            </p>
          </div>
        </Link>
        <Link
          href="/dashboard/contacts"
          className="glass-card p-6 flex items-center gap-4 hover:border-[#4A90D9]/30 transition group"
        >
          <div className="w-12 h-12 rounded-xl bg-[#4A90D9]/10 flex items-center justify-center text-[#4A90D9] group-hover:scale-110 transition">
            <Users size={22} />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Sync Contacts</h4>
            <p className="text-xs text-[var(--color-fz-text-muted)]">
              Import from Google Sheets
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
