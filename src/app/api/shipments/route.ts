import { createServerSupabaseClient } from '@/lib/supabase';
import { generateReference } from '@/lib/utils';
import type { CreateShipmentRequest } from '@/types';

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    // Use !column_name syntax to disambiguate multiple FKs pointing to the same table
    let query = supabase
      .from('shipments')
      .select(`
        *,
        origin_contact:contacts!origin_contact_id(*),
        destination_contact:contacts!destination_contact_id(*),
        carrier:contacts!carrier_id(*)
      `)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateShipmentRequest = await request.json();
    const { origin_contact_id, destination_contact_id, description } = body;

    if (!origin_contact_id || !destination_contact_id || !description) {
      return Response.json(
        { error: 'origin_contact_id, destination_contact_id, and description are required' },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();
    const reference = generateReference();

    const { data, error } = await supabase
      .from('shipments')
      .insert({
        ...body,
        reference,
        status: 'draft',
        created_by: 'system', // TODO Phase 3: replace with session user id
      })
      .select(`
        *,
        origin_contact:contacts!origin_contact_id(*),
        destination_contact:contacts!destination_contact_id(*),
        carrier:contacts!carrier_id(*)
      `)
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });

    await supabase.from('automation_logs').insert({
      event_type: 'shipment_created',
      shipment_id: data.id,
      details: { reference },
      status: 'success',
    });

    return Response.json(data, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
