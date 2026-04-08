import { Settings as SettingsIcon, User, Key, Globe, Bell } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="animate-fade-in-up animate-fade-in-up-1">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-[var(--color-fz-text-muted)]">
          Manage your account and integrations
        </p>
      </div>

      {/* Profile */}
      <div className="glass-card p-6 space-y-4 animate-fade-in-up animate-fade-in-up-2">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <User size={16} className="text-[#00A082]" />
          Profile
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Name</label>
            <input className="input" defaultValue="Admin User" />
          </div>
          <div>
            <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Email</label>
            <input className="input" defaultValue="admin@freshzilla.com" />
          </div>
          <div>
            <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Company</label>
            <input className="input" defaultValue="Freshzilla Logistics" />
          </div>
          <div>
            <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Role</label>
            <input className="input" defaultValue="Admin" disabled />
          </div>
        </div>
        <button className="btn-primary">Save Changes</button>
      </div>

      {/* API Keys */}
      <div className="glass-card p-6 space-y-4 animate-fade-in-up animate-fade-in-up-3">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Key size={16} className="text-[#FF9500]" />
          API Keys
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-[var(--color-fz-surface-2)] rounded-xl">
            <div>
              <p className="text-sm font-medium">Anthropic (Claude AI)</p>
              <p className="text-xs text-[var(--color-fz-text-muted)]">sk-ant-****...7dk3</p>
            </div>
            <span className="badge badge-success text-xs">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-[var(--color-fz-surface-2)] rounded-xl">
            <div>
              <p className="text-sm font-medium">Google Workspace</p>
              <p className="text-xs text-[var(--color-fz-text-muted)]">Service account configured</p>
            </div>
            <span className="badge badge-success text-xs">Connected</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-[var(--color-fz-surface-2)] rounded-xl">
            <div>
              <p className="text-sm font-medium">Supabase</p>
              <p className="text-xs text-[var(--color-fz-text-muted)]">PostgreSQL database</p>
            </div>
            <span className="badge badge-success text-xs">Connected</span>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="glass-card p-6 space-y-4 animate-fade-in-up animate-fade-in-up-4">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Bell size={16} className="text-[#FFC244]" />
          Notifications
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Email on new shipment', enabled: true },
            { label: 'Email on approval request', enabled: true },
            { label: 'Daily summary report', enabled: false },
            { label: 'Weekly analytics digest', enabled: true },
          ].map((pref) => (
            <div key={pref.label} className="flex items-center justify-between">
              <span className="text-sm">{pref.label}</span>
              <div
                className={`w-10 h-6 rounded-full cursor-pointer transition relative ${
                  pref.enabled
                    ? 'bg-[#00A082]'
                    : 'bg-[var(--color-fz-surface-3)]'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full absolute top-1 transition ${
                    pref.enabled ? 'left-5' : 'left-1'
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
