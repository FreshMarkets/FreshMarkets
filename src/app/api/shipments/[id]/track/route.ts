import { createServerSupabaseClient } from '@/lib/supabase';
import { fetchContainerTracking } from '@/lib/safecube';

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
      .select('id, reference, container_number, sealine_scac')
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
    const trackingEvents =
      tracking.containers?.flatMap((c) => c.events ?? []) ?? [];

    // Persist to DB
    const { error: updateError } = await supabase
      .from('shipments')
      .update({
        tracking_status: trackingStatus,
        tracking_eta: trackingEta,
        tracking_updated_at: new Date().toISOString(),
        tracking_events: trackingEvents,
      })
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
      vessels: tracking.vessels ?? [],
      route: tracking.route ?? null,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
