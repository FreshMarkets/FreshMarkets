// SafeCube / Sinay Container Tracking API client
// Docs: https://documentation.safecube.ai/reference/getting-started-with-container-tracking-api

const BASE_URL = 'https://api.sinay.ai/container-tracking/api/v2';

export type ShipmentType = 'CT' | 'BL' | 'BK';

export interface SafeCubeLocation {
  name: string;
  state: string | null;
  country: string | null;
  locode: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

export interface SafeCubeEvent {
  location: SafeCubeLocation | null;
  facility: string | null;
  eventType: string;   // EQUIPMENT | TRANSPORT
  eventCode: string;   // GTOT, ARRI, DEPA, LDND, etc.
  date: string;        // ISO timestamp
  isActual: boolean;
  description: string | null;
}

export interface SafeCubeRoutePort {
  location: SafeCubeLocation | null;
  estimatedDate: string | null;
  actualDate: string | null;
  predictiveEta: string | null;
}

export interface SafeCubeRoute {
  prepol: SafeCubeRoutePort | null;
  pol: SafeCubeRoutePort | null;    // Port of Loading
  pod: SafeCubeRoutePort | null;    // Port of Discharge
  postpod: SafeCubeRoutePort | null;
}

export interface SafeCubeVessel {
  name: string;
  imo: string | null;
  callSign: string | null;
  mmsi: string | null;
  flag: string | null;
}

export interface SafeCubeContainer {
  containerNumber: string;
  events: SafeCubeEvent[];
}

export interface SafeCubeMetadata {
  shipmentType: ShipmentType;
  shipmentNumber: string;
  sealine: string | null;
  shippingStatus: string;
  updatedAt: string;
}

export interface SafeCubeResponse {
  metadata: SafeCubeMetadata;
  locations: SafeCubeLocation[];
  route: SafeCubeRoute | null;
  containers: SafeCubeContainer[];
  vessels: SafeCubeVessel[];
}

export async function fetchContainerTracking(
  shipmentNumber: string,
  shipmentType: ShipmentType = 'CT',
  sealine?: string | null,
): Promise<SafeCubeResponse> {
  const apiKey = process.env.SAFECUBE_API_KEY;
  if (!apiKey) throw new Error('SAFECUBE_API_KEY is not configured');

  const params = new URLSearchParams({ shipmentNumber, shipmentType });
  if (sealine) params.set('sealine', sealine);

  const res = await fetch(`${BASE_URL}/shipment?${params}`, {
    headers: {
      'x-api-key': apiKey,
      'Accept': 'application/json',
    },
    // Don't cache — always return live tracking data
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SafeCube API error ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<SafeCubeResponse>;
}
