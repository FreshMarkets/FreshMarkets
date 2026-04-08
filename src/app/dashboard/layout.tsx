'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Users,
  Mail,
  Bot,
  Settings,
  FileText,
  Ship,
  Shield,
  Menu,
  X,
  Bell,
  LogOut,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Shipments', href: '/dashboard/shipments', icon: Package },
  { label: 'Tracking', href: '/dashboard/tracking', icon: Ship },
  { label: 'Contacts', href: '/dashboard/contacts', icon: Users },
  { label: 'Emails', href: '/dashboard/emails', icon: Mail },
  { label: 'AI Assistant', href: '/dashboard/ai-assistant', icon: Bot },
  { label: 'Reports', href: '/dashboard/reports', icon: FileText },
];

const ADMIN_ITEMS = [
  { label: 'Audit Logs', href: '/dashboard/admin/logs', icon: Shield },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email);
    });
  }, []);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const userInitial = userEmail.charAt(0).toUpperCase() || 'A';

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside className="sidebar hidden md:flex flex-col w-64 p-4 fixed h-full z-30">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00C49A] to-[#00A082] flex items-center justify-center font-bold text-white text-base shadow-lg shadow-[#00A082]/20">
            F
          </div>
          <span className="text-lg font-bold tracking-tight">
            Fresh<span className="text-[#00A082]">zilla</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5">
          <div className="text-xs font-semibold text-[var(--color-fz-text-muted)] uppercase tracking-wider px-3 mb-2">
            Main
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${active ? 'active' : ''}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}

          <div className="text-xs font-semibold text-[var(--color-fz-text-muted)] uppercase tracking-wider px-3 mt-6 mb-2">
            Admin
          </div>
          {ADMIN_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${active ? 'active' : ''}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User area */}
        <div className="border-t border-[var(--color-fz-border)] pt-4 mt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00C49A] to-[#00A082] flex items-center justify-center text-sm font-semibold text-white">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-[var(--color-fz-text-muted)] truncate">
                {userEmail || '—'}
              </div>
            </div>
            <button className="btn-ghost p-1.5" onClick={handleLogout} title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--color-fz-surface)]/80 backdrop-blur-xl border-b border-[var(--color-fz-border)] px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2">
          <Menu size={20} />
        </button>
        <span className="text-base font-bold">
          Fresh<span className="text-[#00A082]">zilla</span>
        </span>
        <button className="btn-ghost p-2 relative">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#00A082] rounded-full" />
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="sidebar absolute left-0 top-0 w-72 h-full p-4 flex flex-col" style={{ display: 'flex' }}>
            <div className="flex items-center justify-between mb-6 px-2">
              <span className="text-lg font-bold">
                Fresh<span className="text-[#00A082]">zilla</span>
              </span>
              <button onClick={() => setMobileOpen(false)} className="btn-ghost p-2">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`sidebar-link ${active ? 'active' : ''}`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen">
        {/* Top bar (desktop) */}
        <div className="hidden md:flex items-center justify-between px-8 py-4 border-b border-[var(--color-fz-border)] bg-[var(--color-fz-bg)]/60 backdrop-blur-xl sticky top-0 z-20">
          <div>
            <h2 className="text-lg font-semibold capitalize">
              {pathname === '/dashboard'
                ? 'Dashboard'
                : pathname.split('/').pop()?.replace(/-/g, ' ') || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn-ghost p-2 relative">
              <Bell size={18} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-[#00A082] rounded-full" />
            </button>
            <div className="w-px h-6 bg-[var(--color-fz-border)]" />
            <div className="flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00C49A] to-[#00A082] flex items-center justify-center text-xs font-semibold text-white">
                {userInitial}
              </div>
              <span className="text-sm text-[var(--color-fz-text-secondary)]">
                {userEmail.split('@')[0] || '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
