import { createServerSupabaseClient } from '@/lib/supabase';

const EDITABLE_FIELDS = new Set([
  'po_number',
  'product',
  'supplier',
  'loading_status',
  'company',
  'loading_date',
  'eta_override',
  'update_note',
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Only allow updating editable fields
    const updates: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      if (EDITABLE_FIELDS.has(key)) {
        updates[key] = typeof value === 'string' && value.trim() ? value.trim() : null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from('shipments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data);
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    const { error } = await supabase.from('shipments').delete().eq('id', id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
