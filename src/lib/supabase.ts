import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// ---- Server-side client (for API routes & server components) ----

export function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[supabase] Missing env vars — running without database. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for full functionality.');
  }

  return createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseServiceKey ?? 'placeholder');
}

// ---- Browser-side client (for client components) ----
// Uses @supabase/ssr so session cookies are set correctly for middleware

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
