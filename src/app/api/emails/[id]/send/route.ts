import { createGmailDraft, sendGmailDraft } from '@/lib/google-workspace';
import { createServerSupabaseClient } from '@/lib/supabase';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerSupabaseClient();

    const { data: draft, error: fetchError } = await supabase
      .from('email_drafts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !draft) {
      return Response.json({ error: 'Email draft not found' }, { status: 404 });
    }

    if (draft.status === 'sent') {
      return Response.json({ error: 'Email has already been sent' }, { status: 409 });
    }

    let gmailMessageId: string;
    try {
      const gmailDraftId = await createGmailDraft({
        to: draft.recipient_email,
        cc: draft.cc_emails?.join(', ') || undefined,
        subject: draft.subject,
        body: draft.body,
      });
      gmailMessageId = await sendGmailDraft(gmailDraftId);
    } catch (err) {
      // Log the failure
      await supabase.from('automation_logs').insert({
        event_type: 'email_send_failed',
        shipment_id: draft.shipment_id,
        details: { draft_id: id, error: String(err) },
        status: 'error',
        error_message: String(err),
      });
      return Response.json(
        { error: `Gmail API error: ${String(err)}` },
        { status: 500 },
      );
    }

    const sentAt = new Date().toISOString();
    await supabase
      .from('email_drafts')
      .update({ status: 'sent', sent_at: sentAt, gmail_message_id: gmailMessageId })
      .eq('id', id);

    await supabase.from('automation_logs').insert({
      event_type: 'email_sent',
      shipment_id: draft.shipment_id,
      details: { draft_id: id, recipient: draft.recipient_email, gmail_message_id: gmailMessageId },
      status: 'success',
    });

    return Response.json({ success: true, gmail_message_id: gmailMessageId, sent_at: sentAt });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
