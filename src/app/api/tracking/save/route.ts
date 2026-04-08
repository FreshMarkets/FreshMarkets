import { createServerSupabaseClient } from '@/lib/supabase';
import { fetchContainerTracking } from '@/lib/safecube';
import { generateReference } from '@/lib/utils';

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

export async function POST(request: Request) {
  try {
    const { container_number, sealine } = await request.json();

    if (!container_number?.trim()) {
      return Response.json(
        { error: 'container_number is required' },
        { status: 400 },
      );
    }

    const containerNum = container_number.trim().toUpperCase();
    const supabase = createServerSupabaseClient();

    // Check if already tracked
    const { data: existing } = await supabase
      .from('shipments')
      .select('id')
      .eq('container_number', containerNum)
      .maybeSingle();

    if (existing) {
      return Response.json(
        { error: 'This container is already being tracked', shipment_id: existing.id },
        { status: 409 },
      );
    }

    // Fetch tracking data from SafeCube
    const tracking = await fetchContainerTracking(
      containerNum,
      'CT',
      sealine || undefined,
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

    // Create shipment record
    const reference = generateReference();
    const description = `Container ${containerNum}${tracking.vessels?.[0]?.name ? ` · ${typeof tracking.vessels[0].name === 'string' ? tracking.vessels[0].name : ''}` : ''}`;

    const { data: shipment, error: insertError } = await supabase
      .from('shipments')
      .insert({
        reference,
        description,
        status: 'confirmed',
        container_number: containerNum,
        sealine_scac: sealine || null,
        tracking_status: trackingStatus,
        tracking_eta: trackingEta,
        tracking_updated_at: new Date().toISOString(),
        tracking_events: trackingEvents,
        created_by: 'system',
      })
      .select()
      .single();

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    await supabase.from('automation_logs').insert({
      event_type: 'container_saved',
      shipment_id: shipment.id,
      details: {
        reference,
        container_number: containerNum,
        tracking_status: trackingStatus,
      },
      status: 'success',
    });

    return Response.json(shipment, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
