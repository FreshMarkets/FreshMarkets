import { createServerSupabaseClient } from '@/lib/supabase';
import {
  runAgentLoop,
  buildPreviewPayload,
  execCreateShipment,
  execSendEmailWithAttachment,
} from '@/lib/agent-tools';
import type { AgentCompleteResponse, AgentNeedsApprovalResponse, AgentSessionRow } from '@/lib/agent-types';
import type Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  try {
    const body: { session_id: string; action: 'approve' | 'cancel' } = await request.json();
    const { session_id, action } = body;

    if (!session_id || !action) {
      return Response.json({ error: 'session_id and action are required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Load the session
    const { data: session, error: loadError } = await supabase
      .from('agent_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('status', 'pending')
      .single();

    if (loadError || !session) {
      return Response.json({ error: 'Session not found or already processed' }, { status: 404 });
    }

    const s = session as AgentSessionRow;

    // Check expiry
    if (new Date(s.expires_at) < new Date()) {
      await supabase.from('agent_sessions').update({ status: 'cancelled' }).eq('id', session_id);
      return Response.json({ error: 'Session expired' }, { status: 410 });
    }

    if (action === 'cancel') {
      await supabase.from('agent_sessions').update({ status: 'cancelled' }).eq('id', session_id);

      // Persist cancellation message
      if (s.conversation_id) {
        await supabase.from('messages').insert({
          conversation_id: s.conversation_id,
          role: 'assistant',
          content: `Action cancelled. The ${s.pending_tool} was not executed.`,
        });
      }

      const response: AgentCompleteResponse = {
        status: 'complete',
        conversation_id: s.conversation_id ?? '',
        steps: [],
        message: `Action cancelled. The ${s.pending_tool} was not executed.`,
      };
      return Response.json(response, { status: 200 });
    }

    // action === 'approve' — execute the pending tool
    const fileBuffers: Record<string, string> = (s.file_buffers as Record<string, string>) ?? {};
    let toolResultText: string;

    try {
      if (s.pending_tool === 'create_shipment') {
        toolResultText = await execCreateShipment(
          s.pending_inputs as Parameters<typeof execCreateShipment>[0],
        );
      } else if (s.pending_tool === 'send_email_with_attachment') {
        const inp = s.pending_inputs as {
          email_draft_id: string;
          attachment_file_id?: string;
          attachment_name?: string;
          attachment_mime?: string;
        };
        toolResultText = await execSendEmailWithAttachment({ ...inp, fileBuffers });
      } else {
        return Response.json({ error: `Unknown pending tool: ${s.pending_tool}` }, { status: 400 });
      }
    } catch (err) {
      toolResultText = `Error: ${String(err)}`;
    }

    // Find the tool_use block id from the last assistant message so we can attach a tool_result
    const msgs = s.messages_json as Anthropic.MessageParam[];
    const lastAssistant = [...msgs].reverse().find((m) => m.role === 'assistant');
    let toolUseId = 'unknown';
    if (lastAssistant && Array.isArray(lastAssistant.content)) {
      const toolBlock = (lastAssistant.content as Anthropic.ContentBlock[]).find(
        (b) => b.type === 'tool_use' && (b as Anthropic.ToolUseBlock).name === s.pending_tool,
      ) as Anthropic.ToolUseBlock | undefined;
      if (toolBlock) toolUseId = toolBlock.id;
    }

    // Append tool_result to messages and resume the loop
    const resumeMessages: Anthropic.MessageParam[] = [
      ...msgs,
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: toolUseId, content: toolResultText }],
      },
    ];

    const result = await runAgentLoop(resumeMessages, fileBuffers);

    // Mark session as executed
    await supabase.from('agent_sessions').update({ status: 'executed' }).eq('id', session_id);

    if (result.stoppedAtGate && result.pendingToolName && result.pendingToolInput && result.pendingToolUseId) {
      // Another gate — create a new session
      const preview = await buildPreviewPayload('', result.pendingToolName, result.pendingToolInput);

      const { data: newSession, error: sessionError } = await supabase
        .from('agent_sessions')
        .insert({
          conversation_id: s.conversation_id,
          messages_json: result.finalMessages,
          pending_tool: result.pendingToolName,
          pending_inputs: result.pendingToolInput,
          file_buffers: Object.keys(result.fileBuffers).length > 0 ? result.fileBuffers : null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (sessionError || !newSession) {
        return Response.json({ error: 'Failed to save new agent session' }, { status: 500 });
      }

      preview.session_id = newSession.id;

      const responseBody: AgentNeedsApprovalResponse = {
        status: 'needs_approval',
        conversation_id: s.conversation_id ?? '',
        session_id: newSession.id,
        preview,
        steps: result.steps,
      };
      return Response.json(responseBody, { status: 202 });
    }

    // Loop complete — persist final assistant message
    const finalText = result.finalText ?? 'Done.';

    if (s.conversation_id) {
      await supabase.from('messages').insert({
        conversation_id: s.conversation_id,
        role: 'assistant',
        content: finalText,
      });
    }

    const responseBody: AgentCompleteResponse = {
      status: 'complete',
      conversation_id: s.conversation_id ?? '',
      steps: result.steps,
      message: finalText,
    };
    return Response.json(responseBody, { status: 200 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
