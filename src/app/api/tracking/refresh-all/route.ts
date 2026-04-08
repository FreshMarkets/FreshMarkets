import { createServerSupabaseClient } from '@/lib/supabase';
import { fetchContainerTracking } from '@/lib/safecube';

function strVal(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'name' in val) {
    const n = (val as Record<string, unknown>).name;
    return typeof n === 'string' ? n : null;
  }
  return null;
}

function normalizeEvent(ev: Record<string, unknown>) {
  const loc = ev.location as Record<string, unknown> | null;
  return {
    ...ev,
    location: loc
      ? {
          name: strVal(loc.name) ?? strVal(loc) ?? null,
          country:
            typeof loc.country === 'string'
              ? loc.country
              : (loc.countryCode as string) ?? null,
          locode: (loc.locode as string) ?? null,
        }
      : null,
    facility:
      typeof ev.facility === 'string' ? ev.facility : strVal(ev.facility),
  };
}

// Called by Vercel Cron or manually — refreshes all active tracked shipments
export async function GET(request: Request) {
  // Optional: verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();

  // Get all shipments with a container number that aren't delivered
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('id, container_number, sealine_scac, tracking_status')
    .not('container_number', 'is', null)
    .not('tracking_status', 'eq', 'DELIVERED');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; status: string; ok: boolean }[] = [];

  for (const shipment of shipments ?? []) {
    try {
      const tracking = await fetchContainerTracking(
        shipment.container_number!,
        'CT',
        shipment.sealine_scac,
      );

      const rawEvents =
        tracking.containers?.flatMap((c) => c.events ?? []) ?? [];
      const trackingEvents = rawEvents.map((ev) =>
        normalizeEvent(ev as unknown as Record<string, unknown>),
      );
      const trackingStatus = tracking.metadata?.shippingStatus ?? null;
      const trackingEta =
        tracking.route?.pod?.predictiveEta ??
        tracking.route?.pod?.estimatedDate ??
        null;

      await supabase
        .from('shipments')
        .update({
          tracking_status: trackingStatus,
          tracking_eta: trackingEta,
          tracking_updated_at: new Date().toISOString(),
          tracking_events: trackingEvents,
        })
        .eq('id', shipment.id);

      results.push({
        id: shipment.id,
        status: trackingStatus ?? 'unknown',
        ok: true,
      });
    } catch (err) {
      results.push({ id: shipment.id, status: String(err), ok: false });
    }
  }

  return Response.json({
    refreshed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
