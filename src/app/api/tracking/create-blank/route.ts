import { createServerSupabaseClient } from '@/lib/supabase';
import { generateReference } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createServerSupabaseClient();

    const reference = generateReference();
    const { data: shipment, error: insertError } = await supabase
      .from('shipments')
      .insert({
        reference,
        description: body.description || 'New tracking entry',
        status: 'confirmed',
        container_number: null,
        loading_status: 'not_started',
        po_number: body.po_number || null,
        product: body.product || null,
        supplier: body.supplier || null,
        company: body.company || null,
        created_by: 'system',
      })
      .select()
      .single();

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    return Response.json(shipment, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
