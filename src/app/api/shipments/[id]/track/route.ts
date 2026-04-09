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
          country: typeof loc.country === 'string' ? loc.country : (loc.countryCode as string) ?? null,
          locode: (loc.locode as string) ?? null,
        }
      : null,
    facility: typeof ev.facility === 'string' ? ev.facility : strVal(ev.facility),
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    // Fetch shipment
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select('id, reference, container_number, sealine_scac, loading_date, eta_override')
      .eq('id', id)
      .single();

    if (fetchError || !shipment) {
      return Response.json({ error: 'Shipment not found' }, { status: 404 });
    }

    if (!shipment.container_number) {
      return Response.json(
        { error: 'Shipment has no container number to track' },
        { status: 400 },
      );
    }

    // Call SafeCube API
    const tracking = await fetchContainerTracking(
      shipment.container_number,
      'CT',
      shipment.sealine_scac,
    );

    // Extract key fields
    const trackingStatus = tracking.metadata?.shippingStatus ?? null;
    const trackingEta =
      tracking.route?.pod?.predictiveEta ??
      tracking.route?.pod?.estimatedDate ??
      null;
    const rawEvents = tracking.containers?.flatMap((c) => c.events ?? []) ?? [];
    const trackingEvents = rawEvents.map((ev) => normalizeEvent(ev as unknown as Record<string, unknown>));

    // Autofill loading_date from first actual load event (only if not manually set)
    const loadEvent = rawEvents.find(
      (e) => e.isActual && (e.eventCode === 'LDND' || e.eventCode === 'DEPA' || e.eventCode === 'GTOT'),
    );
    const autoLoadingDate = loadEvent ? loadEvent.date.slice(0, 10) : null;
    const autoEtaDate = trackingEta ? trackingEta.slice(0, 10) : null;

    // Persist to DB
    const updates: Record<string, unknown> = {
      tracking_status: trackingStatus,
      tracking_eta: trackingEta,
      tracking_updated_at: new Date().toISOString(),
      tracking_events: trackingEvents,
    };
    // Only autofill dates if not manually overridden
    if (!shipment.loading_date && autoLoadingDate) updates.loading_date = autoLoadingDate;
    if (!shipment.eta_override && autoEtaDate) updates.eta_override = autoEtaDate;

    const { error: updateError } = await supabase
      .from('shipments')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      return Response.json({ error: updateError.message }, { status: 500 });
    }

    // Log the event
    await supabase.from('automation_logs').insert({
      event_type: 'tracking_refreshed',
      shipment_id: id,
      details: {
        reference: shipment.reference,
        container_number: shipment.container_number,
        tracking_status: trackingStatus,
        tracking_eta: trackingEta,
        events_count: trackingEvents.length,
      },
      status: 'success',
    });

    return Response.json({
      tracking_status: trackingStatus,
      tracking_eta: trackingEta,
      tracking_updated_at: new Date().toISOString(),
      tracking_events: trackingEvents,
      loading_date: (updates.loading_date as string) ?? shipment.loading_date,
      eta_override: (updates.eta_override as string) ?? shipment.eta_override,
      vessels: tracking.vessels ?? [],
      route: tracking.route ?? null,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
