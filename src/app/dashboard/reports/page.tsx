import {
  Package,
  TrendingUp,
  Clock,
  DollarSign,
  Truck,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react';
import { createServerSupabaseClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';

export default async function ReportsPage() {
  const supabase = createServerSupabaseClient();

  // Parallel queries
  const [
    { count: totalShipments },
    { data: costData },
    { count: successLogs },
    { count: totalLogs },
    { data: carrierRows },
    { data: monthlyRows },
  ] = await Promise.all([
    supabase.from('shipments').select('*', { count: 'exact', head: true }),
    supabase.from('shipments').select('value_usd'),
    supabase.from('automation_logs').select('*', { count: 'exact', head: true }).eq('status', 'success'),
    supabase.from('automation_logs').select('*', { count: 'exact', head: true }),
    supabase
      .from('shipments')
      .select('carrier_id, value_usd, carrier:contacts!carrier_id(name)')
      .not('carrier_id', 'is', null),
    supabase
      .from('shipments')
      .select('created_at')
      .order('created_at', { ascending: true }),
  ]);

  // Total freight cost
  const totalCost = (costData ?? []).reduce((sum, r) => sum + (Number(r.value_usd) || 0), 0);

  // Automation rate
  const automationRate = totalLogs && totalLogs > 0
    ? Math.round(((successLogs ?? 0) / totalLogs) * 100)
    : 0;

  // Carrier performance: group by carrier
  const carrierMap = new Map<string, { name: string; shipments: number; cost: number }>();
  for (const row of carrierRows ?? []) {
    const carrier = row.carrier as unknown as { name: string } | null;
    const name = carrier?.name ?? 'Unknown';
    const existing = carrierMap.get(row.carrier_id) ?? { name, shipments: 0, cost: 0 };
    existing.shipments += 1;
    existing.cost += Number(row.value_usd) || 0;
    carrierMap.set(row.carrier_id, existing);
  }
  const carrierData = Array.from(carrierMap.values())
    .sort((a, b) => b.shipments - a.shipments)
    .slice(0, 6);

  // Monthly shipments: group by YYYY-MM
  const monthMap = new Map<string, { total: number; label: string }>();
  for (const row of monthlyRows ?? []) {
    const d = new Date(row.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en', { month: 'short' });
    const existing = monthMap.get(key) ?? { total: 0, label };
    existing.total += 1;
    monthMap.set(key, existing);
  }
  // Last 6 months
  const monthlyData = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => v);

  const maxShipments = Math.max(...monthlyData.map((d) => d.total), 1);

  const metrics = [
    {
      label: 'Total Shipments',
      value: String(totalShipments ?? 0),
      icon: Package,
      accent: '#10b981',
    },
    {
      label: 'Avg. Time per Shipment',
      value: '8 min',
      icon: Clock,
      accent: '#6366f1',
    },
    {
      label: 'Total Freight Value',
      value: formatCurrency(totalCost, 'EUR'),
      icon: DollarSign,
      accent: '#f59e0b',
    },
    {
      label: 'Automation Rate',
      value: `${automationRate}%`,
      icon: TrendingUp,
      accent: '#3b82f6',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up animate-fade-in-up-1">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-sm text-[var(--color-fz-text-muted)]">
          Performance overview
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {metrics.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`stat-card animate-fade-in-up animate-fade-in-up-${i + 1}`}
              style={{ '--accent-color': m.accent } as React.CSSProperties}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[var(--color-fz-text-muted)] mb-1">{m.label}</p>
                  <p className="text-2xl font-bold">{m.value}</p>
                </div>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${m.accent}20`, color: m.accent }}
                >
                  <Icon size={20} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Monthly trend chart */}
        <div className="glass-card p-6 animate-fade-in-up animate-fade-in-up-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold flex items-center gap-2">
              <BarChart3 size={18} className="text-emerald-400" />
              Monthly Shipments
            </h3>
          </div>
          {monthlyData.length === 0 ? (
            <p className="text-sm text-[var(--color-fz-text-muted)] text-center py-12">No shipment data yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-48">
              {monthlyData.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative" style={{ height: '160px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-emerald-500/40 rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${(d.total / maxShipments) * 100}%`,
                      }}
                    />
                    <div
                      className="absolute w-full text-center text-xs font-medium text-emerald-400"
                      style={{
                        bottom: `${(d.total / maxShipments) * 100 + 2}%`,
                      }}
                    >
                      {d.total}
                    </div>
                  </div>
                  <span className="text-xs text-[var(--color-fz-text-muted)]">{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Carrier performance */}
        <div className="glass-card p-6 animate-fade-in-up animate-fade-in-up-6">
          <h3 className="font-semibold flex items-center gap-2 mb-6">
            <Truck size={18} className="text-indigo-400" />
            Carrier Performance
          </h3>
          {carrierData.length === 0 ? (
            <p className="text-sm text-[var(--color-fz-text-muted)] text-center py-12">No carrier data yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Carrier</th>
                  <th>Shipments</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {carrierData.map((c) => (
                  <tr key={c.name}>
                    <td className="font-medium text-[var(--color-fz-text)]">{c.name}</td>
                    <td>{c.shipments}</td>
                    <td className="font-mono text-sm">{formatCurrency(c.cost, 'EUR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Time savings */}
      <div className="glass-card p-8 animate-fade-in-up animate-fade-in-up-6">
        <div className="text-center max-w-lg mx-auto">
          <div className="text-5xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent mb-2">
            {((totalShipments ?? 0) * 1.37).toFixed(1)} hours
          </div>
          <p className="text-[var(--color-fz-text-secondary)] mb-1">estimated time saved</p>
          <p className="text-sm text-[var(--color-fz-text-muted)]">
            Based on {totalShipments ?? 0} shipments × ~1.5 hours manual work → ~8 minutes with Freshzilla AI
          </p>
        </div>
      </div>
    </div>
  );
}
