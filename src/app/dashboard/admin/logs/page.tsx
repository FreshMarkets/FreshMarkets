import { createServerSupabaseClient } from '@/lib/supabase';
import { timeAgo } from '@/lib/utils';
import {
  Shield,
  CheckCircle,
  Clock,
  AlertCircle,
  Mail,
  FileText,
  RefreshCw,
  Bot,
  Download,
} from 'lucide-react';

function eventIcon(type: string) {
  switch (type) {
    case 'email_sent':
      return <Mail size={14} />;
    case 'pdf_generated':
      return <FileText size={14} />;
    case 'sheet_synced':
      return <RefreshCw size={14} />;
    case 'ai_email_draft':
      return <Bot size={14} />;
    case 'approval_requested':
      return <Clock size={14} />;
    default:
      return <Shield size={14} />;
  }
}

export default async function AuditLogsPage() {
  const supabase = createServerSupabaseClient();
  const { data: logs } = await supabase
    .from('automation_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up animate-fade-in-up-1">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-[var(--color-fz-text-muted)]">
            Complete history of all system actions
          </p>
        </div>
        <button className="btn-secondary">
          <Download size={16} />
          Export
        </button>
      </div>

      <div className="glass-card overflow-hidden animate-fade-in-up animate-fade-in-up-2">
        <table className="data-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Status</th>
              <th>Details</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-12 text-[var(--color-fz-text-muted)]">
                  No logs yet.
                </td>
              </tr>
            )}
            {(logs ?? []).map((log) => (
              <tr key={log.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        log.status === 'success'
                          ? 'bg-[#00A082]/10 text-[#00A082]'
                          : log.status === 'pending'
                          ? 'bg-[#FFC244]/15 text-[#B8860B]'
                          : 'bg-[#FF4C4C]/10 text-[#D93636]'
                      }`}
                    >
                      {eventIcon(log.event_type)}
                    </div>
                    <span className="font-medium text-[var(--color-fz-text)] capitalize">
                      {log.event_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    className={`badge text-xs ${
                      log.status === 'success'
                        ? 'badge-success'
                        : log.status === 'pending'
                        ? 'badge-warning'
                        : 'badge-error'
                    }`}
                  >
                    {log.status}
                  </span>
                </td>
                <td>
                  <span className="text-xs text-[var(--color-fz-text-muted)] font-mono">
                    {JSON.stringify(log.details).slice(0, 60)}
                  </span>
                </td>
                <td className="text-[var(--color-fz-text-muted)] text-xs">
                  {timeAgo(log.created_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
