import { fetchContainerTracking } from '@/lib/safecube';

export async function POST(request: Request) {
  try {
    const { container_number, sealine } = await request.json();

    if (!container_number?.trim()) {
      return Response.json(
        { error: 'container_number is required' },
        { status: 400 },
      );
    }

    const data = await fetchContainerTracking(
      container_number.trim().toUpperCase(),
      'CT',
      sealine || undefined,
    );

    const events = data.containers?.flatMap((c) => c.events) ?? [];
    const eta =
      data.route?.pod?.predictiveEta ?? data.route?.pod?.estimatedDate ?? null;

    return Response.json({
      status: data.metadata.shippingStatus,
      eta,
      events,
      vessel: data.vessels?.[0]?.name ?? null,
      route: {
        pol: data.route?.pol?.location?.name ?? null,
        pod: data.route?.pod?.location?.name ?? null,
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
