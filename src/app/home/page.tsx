'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import {
  Package,
  Mail,
  Users,
  Bot,
  FileText,
  Shield,
  Plus,
  LogOut,
  Send,
} from 'lucide-react';

// Base hub dimensions (mobile / default)
const BASE_RADIUS      = 130;
const BASE_CX          = 180;
const BASE_CY          = 178;
const BASE_BLOB_W      = 86;
const BASE_BLOB_H      = 96;
const BASE_CENTER_SIZE = 124;

const BLOBS = [
  '60% 40% 30% 70% / 60% 30% 70% 40%',
  '40% 60% 70% 30% / 50% 60% 30% 60%',
  '50% 50% 30% 70% / 30% 60% 50% 50%',
  '70% 30% 50% 50% / 40% 50% 60% 70%',
  '40% 60% 60% 40% / 60% 30% 70% 40%',
  '60% 40% 40% 60% / 30% 60% 40% 70%',
];

const CENTER_BLOB = '55% 45% 40% 60% / 50% 40% 60% 50%';

const HUB_ITEMS = [
  { label: 'Shipments',    href: '/dashboard/shipments',    icon: Package,  angle: 0,   blob: BLOBS[0] },
  { label: 'Emails',       href: '/dashboard/emails',       icon: Mail,     angle: 60,  blob: BLOBS[1] },
  { label: 'Reports',      href: '/dashboard/reports',      icon: FileText, angle: 120, blob: BLOBS[2] },
  { label: 'Audit Logs',   href: '/dashboard/admin/logs',   icon: Shield,   angle: 180, blob: BLOBS[3] },
  { label: 'Contacts',     href: '/dashboard/contacts',     icon: Users,    angle: 240, blob: BLOBS[4] },
  { label: 'AI Assistant', href: '/dashboard/ai-assistant', icon: Bot,      angle: 300, blob: BLOBS[5] },
];

function polarToCart(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Math.round(radius * Math.cos(rad)),
    y: Math.round(radius * Math.sin(rad)),
  };
}

export default function HomePage() {
  const router = useRouter();
  const [userName, setUserName]   = useState('');
  const [chatInput, setChatInput] = useState('');
  const [hubScale, setHubScale]   = useState(1);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1280)      setHubScale(1.35);
      else if (window.innerWidth >= 1024) setHubScale(1.18);
      else                                setHubScale(1);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return; }
      if (user.email) setUserName(user.email.split('@')[0]);
    });
  }, [router]);

  const handleLogout = async () => {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Scaled hub dimensions
  const radius      = Math.round(BASE_RADIUS      * hubScale);
  const cx          = Math.round(BASE_CX          * hubScale);
  const cy          = Math.round(BASE_CY          * hubScale);
  const w           = cx * 2;
  const h           = cy * 2;
  const blobW       = Math.round(BASE_BLOB_W      * hubScale);
  const blobH       = Math.round(BASE_BLOB_H      * hubScale);
  const centerSize  = Math.round(BASE_CENTER_SIZE * hubScale);
  const iconSize    = Math.round(24               * hubScale);
  const labelSize   = Math.round(9.5              * hubScale);
  const centerIcon  = Math.round(22               * hubScale);

  return (
    <div
      className="h-screen overflow-hidden flex flex-col"
      style={{ background: 'linear-gradient(160deg, #FFD166 0%, #FFC244 55%, #FFB020 100%)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-bold text-[#1A1000]">
          <span style={{ color: '#FFFFFF' }}>Fresh</span><span style={{ color: '#00A082' }}>zilla</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-[#7A4F00] hover:text-[#3D2000] transition px-3 py-1.5 rounded-full hover:bg-black/10"
          >
            Dashboard →
          </Link>
          <button
            onClick={handleLogout}
            className="p-2 rounded-full hover:bg-black/10 transition text-[#7A4F00] hover:text-[#3D2000]"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* AI Chat Bar — equal space between top bar and greeting */}
      <div className="flex items-center justify-center px-4 py-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = chatInput.trim();
            if (q) router.push(`/dashboard/ai-assistant?q=${encodeURIComponent(q)}`);
          }}
          className="relative w-full max-w-sm"
        >
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask AI Assistant anything..."
            className="w-full rounded-full py-3 pl-5 pr-14 text-sm font-medium text-[#1A1000] outline-none"
            style={{
              background: 'rgba(255,255,255,0.85)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            }}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'linear-gradient(135deg, #00C49A, #00A082)' }}
          >
            <Send size={15} color="white" />
          </button>
        </form>
      </div>

      {/* Hub */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 pb-4">
        {/* Greeting */}
        <div className="text-center select-none">
          <h1 className="text-2xl font-bold text-[#1A1000]">
            {userName ? `Hello, ${userName} 👋` : 'Welcome back 👋'}
          </h1>
          <p className="text-[#7A4F00] text-sm mt-1 font-medium">
            What would you like to do today?
          </p>
        </div>

        {/* Hub container */}
        <div className="relative flex-shrink-0" style={{ width: w, height: h }}>

          {/* Dashed connector lines */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${w} ${h}`}
          >
            {HUB_ITEMS.map((item) => {
              const { x, y } = polarToCart(item.angle, radius);
              return (
                <line
                  key={item.href}
                  x1={cx} y1={cy}
                  x2={cx + x} y2={cy + y}
                  stroke="rgba(255,255,255,0.40)"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                />
              );
            })}
          </svg>

          {/* Orbit blobs */}
          {HUB_ITEMS.map((item) => {
            const { x, y } = polarToCart(item.angle, radius);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="absolute group"
                style={{
                  left: cx + x,
                  top:  cy + y,
                  width:  blobW,
                  height: blobH,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="w-full h-full bg-white flex flex-col items-center justify-center gap-1.5 shadow-lg group-hover:shadow-xl group-hover:scale-110 active:scale-95 transition-all duration-200"
                  style={{ borderRadius: item.blob }}
                >
                  <Icon size={iconSize} style={{ color: '#00A082' }} />
                  <span
                    className="font-bold text-center text-[#1A1A2E] leading-tight px-2 uppercase tracking-wide"
                    style={{ fontSize: labelSize }}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Center blob */}
          <Link
            href="/dashboard/shipments/new"
            className="absolute group"
            style={{
              left: cx,
              top:  cy,
              width:  centerSize,
              height: centerSize,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="w-full h-full bg-white flex flex-col items-center justify-center gap-2 group-hover:scale-105 active:scale-95 transition-all duration-200"
              style={{ borderRadius: CENTER_BLOB, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
            >
              <div
                className="rounded-full flex items-center justify-center"
                style={{
                  width: Math.round(40 * hubScale),
                  height: Math.round(40 * hubScale),
                  background: 'linear-gradient(135deg, #00C49A, #00A082)',
                }}
              >
                <Plus size={centerIcon} color="white" strokeWidth={2.5} />
              </div>
              <span
                className="font-bold text-[#1A1A2E] text-center leading-tight uppercase tracking-wide"
                style={{ fontSize: Math.round(10 * hubScale) }}
              >
                New<br />Shipment
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
