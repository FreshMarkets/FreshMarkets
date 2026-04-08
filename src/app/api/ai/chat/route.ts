import { chat } from '@/lib/anthropic';
import { createServerSupabaseClient } from '@/lib/supabase';
import type { AIChatRequest, AIChatResponse, AIAction } from '@/types';

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
      // Create a new conversation
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({
          user_id: 'system', // TODO Phase 3: replace with session user id
          title: message.slice(0, 60),
        })
        .select()
        .single();

      if (convError || !conv) {
        return Response.json({ error: 'Failed to create conversation' }, { status: 500 });
      }
      conversationId = conv.id;
    }

    // Persist the user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    });

    // Build full history for Claude
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...existingMessages,
      { role: 'user', content: message },
    ];

    // Call Claude
    let responseText: string;
    try {
      responseText = await chat(history);
    } catch (err) {
      return Response.json({ error: `AI error: ${String(err)}` }, { status: 500 });
    }

    // Persist the assistant response
    const { data: savedMsg, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: responseText,
      })
      .select()
      .single();

    if (msgError || !savedMsg) {
      return Response.json({ error: 'Failed to save assistant message' }, { status: 500 });
    }

    // Extract action blocks from the response
    const actions: AIAction[] = [];
    const actionRegex = /```action\n([\s\S]*?)\n```/g;
    let match;
    while ((match = actionRegex.exec(responseText)) !== null) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed.type) {
          actions.push({
            type: parsed.type,
            description: parsed.description ?? parsed.type,
            data: parsed.data ?? {},
          });
        }
      } catch {
        // Ignore malformed action blocks
      }
    }

    const result: AIChatResponse = {
      conversation_id: conversationId!,
      message: savedMsg,
      actions: actions.length > 0 ? actions : undefined,
    };

    return Response.json(result, { status: 201 });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
