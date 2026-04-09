import { fetchContainerTracking } from '@/lib/safecube';

function locName(loc: unknown): string | null {
  if (!loc) return null;
  if (typeof loc === 'string') return loc;
  if (typeof loc === 'object' && loc !== null && 'name' in loc) {
    const n = (loc as Record<string, unknown>).name;
    return typeof n === 'string' ? n : null;
  }
  return null;
}

function safeName(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val !== null && 'name' in val) {
    const n = (val as Record<string, unknown>).name;
    return typeof n === 'string' ? n : null;
  }
  return null;
}

function locCountry(loc: unknown): string | null {
  if (!loc || typeof loc !== 'object') return null;
  const o = loc as Record<string, unknown>;
  if (typeof o.country === 'string') return o.country;
  if (typeof o.countryCode === 'string') return o.countryCode;
  return null;
}

function normalizeEvent(ev: Record<string, unknown>) {
  const loc = ev.location as Record<string, unknown> | null;
  return {
    ...ev,
    location: loc
      ? {
          name: locName(loc) ?? locName(loc.name) ?? null,
          country: locCountry(loc),
          locode: (loc.locode as string) ?? null,
        }
      : null,
    facility: typeof ev.facility === 'string' ? ev.facility : safeName(ev.facility),
  };
}

export async function POST(request: Request) {
  try {
    const { container_number, sealine, shipment_type } = await request.json();

    if (!container_number?.trim()) {
      return Response.json(
        { error: 'container_number is required' },
        { status: 400 },
      );
    }

    const type = shipment_type === 'BL' ? 'BL' : shipment_type === 'BK' ? 'BK' : 'CT';
    const data = await fetchContainerTracking(
      container_number.trim().toUpperCase(),
      type as 'CT' | 'BL' | 'BK',
      sealine || undefined,
    );

    const rawEvents = data.containers?.flatMap((c) => c.events) ?? [];
    const events = rawEvents.map((ev) => normalizeEvent(ev as unknown as Record<string, unknown>));
    const eta =
      data.route?.pod?.predictiveEta ?? data.route?.pod?.estimatedDate ?? null;

    const polLoc = data.route?.pol?.location;
    const podLoc = data.route?.pod?.location;

    // Find the latest actual event to determine current location
    const actualRaw = rawEvents
      .filter((e) => e.isActual)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const currentRaw = actualRaw[0] ?? null;
    const currentEvent = currentRaw ? normalizeEvent(currentRaw as unknown as Record<string, unknown>) : null;

    return Response.json({
      status: data.metadata.shippingStatus,
      sealine: data.metadata.sealine ?? null,
      eta,
      events,
      vessel: safeName(data.vessels?.[0]?.name) ?? safeName(data.vessels?.[0]) ?? null,
      route: {
        pol: locName(polLoc) ?? (polLoc ? locName((polLoc as unknown as Record<string, unknown>).name) : null),
        pol_country: polLoc ? locCountry(polLoc as unknown as Record<string, unknown>) : null,
        pod: locName(podLoc) ?? (podLoc ? locName((podLoc as unknown as Record<string, unknown>).name) : null),
        pod_country: podLoc ? locCountry(podLoc as unknown as Record<string, unknown>) : null,
      },
      current_location: currentRaw
        ? {
            name: currentEvent?.location ? (currentEvent.location as { name: string | null }).name : null,
            country: currentEvent?.location ? (currentEvent.location as { country: string | null }).country : null,
            event: currentRaw.eventCode,
            date: currentRaw.date,
          }
        : null,
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
