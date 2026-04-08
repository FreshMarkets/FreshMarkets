import { createServerSupabaseClient } from '@/lib/supabase';
import { runAgentLoop, buildPreviewPayload } from '@/lib/agent-tools';
import type { AIChatRequest } from '@/types';
import type { AgentCompleteResponse, AgentNeedsApprovalResponse } from '@/lib/agent-types';

export async function POST(request: Request) {
  try {
    const body: AIChatRequest = await request.json();
    const { conversation_id, message } = body;

    if (!message?.trim()) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    let conversationId = conversation_id;

    // Fetch or create conversation
    let existingMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (conversationId) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      existingMessages = (msgs ?? []) as typeof existingMessages;
    } else {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ user_id: 'system', title: message.slice(0, 60) })
        .select()
        .single();

      if (convError || !conv) {
        return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
      }
      conversationId = conv.id;
    }

    // Persist user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    });

    // Build message history for the agent loop
    const agentMessages = [
      ...existingMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ];

    // Run the agent loop
    const result = await runAgentLoop(agentMessages);

    if (result.stoppedAtGate && result.pendingToolName && result.pendingToolInput && result.pendingToolUseId) {
      // Persist session state so /execute can resume
      const preview = await buildPreviewPayload('', result.pendingToolName, result.pendingToolInput);

      const { data: session, error: sessionError } = await supabase
        .from('agent_sessions')
        .insert({
          conversation_id: conversationId,
          messages_json: result.finalMessages,
          pending_tool: result.pendingToolName,
          pending_inputs: result.pendingToolInput,
          file_buffers: Object.keys(result.fileBuffers).length > 0 ? result.fileBuffers : null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (sessionError || !session) {
        return Response.json({ error: 'Failed to save agent session' }, { status: 500 });
      }

      preview.session_id = session.id;

      const responseBody: AgentNeedsApprovalResponse = {
        status: 'needs_approval',
        conversation_id: conversationId!,
        session_id: session.id,
        preview,
        steps: result.steps,
      };

      return Response.json(responseBody, { status: 202 });
    }

    // Loop completed — persist assistant message
    const finalText = result.finalText ?? 'Done.';

    const { data: savedMsg, error: msgError } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, role: 'assistant', content: finalText })
      .select()
      .single();

    if (msgError || !savedMsg) {
      return Response.json({ error: 'Failed to save assistant message' }, { status: 500 });
    }

    const responseBody: AgentCompleteResponse = {
      status: 'complete',
      conversation_id: conversationId!,
      steps: result.steps,
      message: finalText,
    };

    return Response.json(responseBody, { status: 200 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
