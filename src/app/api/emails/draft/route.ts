import { generateEmail } from '@/lib/anthropic';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { GenerateEmailRequest, Shipment } from '@/types';

export async function POST(request: Request) {
  try {
    const body: GenerateEmailRequest = await request.json();
    const { shipment_id, draft_type, recipient_email, cc_emails, custom_instructions } = body;

    if (!shipment_id || !draft_type || !recipient_email) {
      return Response.json(
        { error: 'shipment_id, draft_type, and recipient_email are required' },
        { status: 400 },
      );
    }

    const supabase = createServerSupabaseClient();

    // Fetch shipment with hydrated contacts (required by generateEmail)
    const { data: shipment, error: fetchError } = await supabase
      .from('shipments')
      .select(`
        *,
        origin_contact:contacts!origin_contact_id(*),
        destination_contact:contacts!destination_contact_id(*),
        carrier:contacts!carrier_id(*)
      `)
      .eq('id', shipment_id)
      .single();

    if (fetchError || !shipment) {
      return Response.json({ error: 'Shipment not found' }, { status: 404 });
    }

    const s = shipment as Shipment;

    let generated: { subject: string; body: string };
    try {
      generated = await generateEmail({
        shipment: s,
        origin: s.origin_contact ?? undefined,
        destination: s.destination_contact ?? undefined,
        carrier: s.carrier ?? undefined,
        draftType: draft_type,
        customInstructions: custom_instructions,
      });
    } catch (err) {
      return Response.json(
        { error: `AI generation failed: ${String(err)}` },
        { status: 500 },
      );
    }

    const { data: draft, error: insertError } = await supabase
      .from('email_drafts')
      .insert({
        shipment_id,
        draft_type,
        recipient_email,
        cc_emails: cc_emails ?? [],
        subject: generated.subject,
        body: generated.body,
        status: 'draft',
        generated_by: 'claude',
      })
      .select()
      .single();

    if (insertError) {
      return Response.json({ error: insertError.message }, { status: 500 });
    }

    await supabase.from('automation_logs').insert({
      event_type: 'ai_email_draft',
      shipment_id,
      details: { draft_type, draft_id: draft.id },
      status: 'success',
    });

    return Response.json(draft, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
