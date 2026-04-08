// ============================================================
// Freshzilla Agent — Tool definitions, executor, and loop
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabaseClient } from '@/lib/supabase';
import { generateEmail } from '@/lib/anthropic';
import { searchDriveFiles, downloadDriveFile } from '@/lib/google-workspace';
import { generateReference } from '@/lib/utils';
import { google } from 'googleapis';
import type { Shipment, Contact } from '@/types';
import type { AgentStep, PreviewPayload } from '@/lib/agent-types';

// ---- Anthropic client ----

let _client: Anthropic | null = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---- Tool names that require user preview before execution ----

export const PREVIEW_GATE_TOOLS = new Set(['create_shipment', 'send_email_with_attachment']);

// ---- Tool definitions ----

export const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_contacts',
    description:
      'Search Supabase contacts by name fragment and/or contact type. Returns matching contacts with id, name, email, type, city, country.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Partial name to search (case-insensitive)' },
        contact_type: {
          type: 'string',
          enum: ['carrier', 'broker', 'warehouse', 'customer'],
          description: 'Filter by contact type. Omit to search all types.',
        },
      },
      required: [],
    },
  },
  {
    name: 'find_drive_file',
    description:
      'Search Google Drive for files by name keywords and optional date range. Returns file id, name, mimeType, modifiedTime.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name_contains: { type: 'string', description: 'Substring to search in file name' },
        modified_after: {
          type: 'string',
          description: 'ISO 8601 date. Only return files modified after this date.',
        },
        modified_before: {
          type: 'string',
          description: 'ISO 8601 date. Only return files modified before this date.',
        },
        mime_type: { type: 'string', description: 'MIME type filter e.g. application/pdf' },
      },
      required: ['name_contains'],
    },
  },
  {
    name: 'download_drive_file',
    description:
      'Download a file from Google Drive by its file ID. Returns base64-encoded content and mimeType. Use after find_drive_file.',
    input_schema: {
      type: 'object' as const,
      properties: {
        file_id: { type: 'string', description: 'Google Drive file ID from find_drive_file' },
        file_name: { type: 'string', description: 'Human-readable name for display in preview' },
      },
      required: ['file_id', 'file_name'],
    },
  },
  {
    name: 'create_shipment',
    description:
      'Create a new shipment record in Supabase. The system will pause and show a preview before writing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        origin_contact_id: { type: 'string' },
        destination_contact_id: { type: 'string' },
        carrier_id: { type: 'string' },
        description: { type: 'string' },
        weight_kg: { type: 'number' },
        volume_cbm: { type: 'number' },
        value_usd: { type: 'number' },
        currency: { type: 'string', default: 'EUR' },
        incoterm: {
          type: 'string',
          enum: ['FCA', 'CIF', 'FOB', 'EXW', 'DDP', 'DAP', 'CPT', 'CIP'],
        },
        special_handling: { type: 'string' },
      },
      required: ['origin_contact_id', 'destination_contact_id', 'description'],
    },
  },
  {
    name: 'generate_email_draft',
    description:
      'Generate a professional email draft via Claude AI based on shipment details. Saves draft to DB and returns subject, body, and draft ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shipment_id: {
          type: 'string',
          description: 'Supabase shipment ID (from create_shipment result)',
        },
        draft_type: {
          type: 'string',
          enum: ['booking', 'customs', 'load_request', 'notification'],
        },
        recipient_email: { type: 'string' },
        cc_emails: { type: 'array', items: { type: 'string' } },
        custom_instructions: { type: 'string' },
      },
      required: ['shipment_id', 'draft_type', 'recipient_email'],
    },
  },
  {
    name: 'send_email_with_attachment',
    description:
      'Send an email via Gmail, optionally with a file attachment. The system will pause and show a full preview before sending.',
    input_schema: {
      type: 'object' as const,
      properties: {
        email_draft_id: {
          type: 'string',
          description: 'email_drafts.id from generate_email_draft',
        },
        attachment_file_id: {
          type: 'string',
          description: 'Google Drive file ID to attach (from download_drive_file)',
        },
        attachment_name: { type: 'string', description: 'Filename for the attachment' },
        attachment_mime: { type: 'string', description: 'MIME type for the attachment' },
      },
      required: ['email_draft_id'],
    },
  },
];

// ---- System prompt ----

export const AGENT_SYSTEM_PROMPT = `You are Freshzilla Agent, an autonomous supply chain assistant.

When a user requests an action:
1. ALWAYS use search_contacts first to resolve carrier/broker/warehouse names to IDs before using create_shipment.
2. For attachments, use find_drive_file then download_drive_file.
3. Use create_shipment only after all contact IDs are resolved from search_contacts results.
4. Use generate_email_draft after create_shipment returns the shipment ID.
5. Use send_email_with_attachment as the final step.

Today's date: ${new Date().toISOString().split('T')[0]}. Use this when interpreting relative date references like "last month".

Do not ask for clarification if you can infer information from context.
When a tool returns no results, explain what you found and ask the user to clarify.
Never invent contact IDs — always use IDs returned by search_contacts.`;

// ---- Tool implementations ----

async function execSearchContacts(input: {
  query?: string;
  contact_type?: string;
}): Promise<string> {
  const supabase = createServerSupabaseClient();
  let query = supabase
    .from('contacts')
    .select('id, name, email, type, city, country')
    .eq('is_active', true);

  if (input.query) query = query.ilike('name', `%${input.query}%`);
  if (input.contact_type) query = query.eq('type', input.contact_type);

  const { data, error } = await query.limit(10);
  if (error) return `Error: ${error.message}`;
  if (!data || data.length === 0) return 'No contacts found matching the criteria.';
  return JSON.stringify(data);
}

async function execFindDriveFile(input: {
  name_contains: string;
  modified_after?: string;
  modified_before?: string;
  mime_type?: string;
}): Promise<string> {
  const results = await searchDriveFiles(input);
  if (results.length === 0) return 'No files found matching the criteria.';
  return JSON.stringify(results);
}

async function execDownloadDriveFile(
  input: { file_id: string; file_name: string },
  fileBuffers: Record<string, string>,
): Promise<string> {
  const { buffer, mimeType } = await downloadDriveFile(input.file_id);
  const base64 = buffer.toString('base64');
  fileBuffers[input.file_id] = base64;
  const sizeKb = Math.round(buffer.byteLength / 1024);
  return JSON.stringify({
    file_id: input.file_id,
    file_name: input.file_name,
    mimeType,
    size_kb: sizeKb,
    status: 'downloaded',
  });
}

export async function execCreateShipment(input: {
  origin_contact_id: string;
  destination_contact_id: string;
  carrier_id?: string;
  description: string;
  weight_kg?: number;
  volume_cbm?: number;
  value_usd?: number;
  currency?: string;
  incoterm?: string;
  special_handling?: string;
}): Promise<string> {
  const supabase = createServerSupabaseClient();
  const reference = generateReference();

  const { data, error } = await supabase
    .from('shipments')
    .insert({
      ...input,
      reference,
      status: 'draft',
      created_by: 'system',
    })
    .select(
      `*, origin_contact:contacts!origin_contact_id(*), destination_contact:contacts!destination_contact_id(*), carrier:contacts!carrier_id(*)`,
    )
    .single();

  if (error) return `Error creating shipment: ${error.message}`;

  await supabase.from('automation_logs').insert({
    event_type: 'shipment_created',
    shipment_id: data.id,
    details: { reference, source: 'agent' },
    status: 'success',
  });

  return JSON.stringify({ id: data.id, reference, status: data.status });
}

async function execGenerateEmailDraft(input: {
  shipment_id: string;
  draft_type: 'booking' | 'customs' | 'load_request' | 'notification';
  recipient_email: string;
  cc_emails?: string[];
  custom_instructions?: string;
}): Promise<string> {
  const supabase = createServerSupabaseClient();

  const { data: shipment, error: fetchError } = await supabase
    .from('shipments')
    .select(
      `*, origin_contact:contacts!origin_contact_id(*), destination_contact:contacts!destination_contact_id(*), carrier:contacts!carrier_id(*)`,
    )
    .eq('id', input.shipment_id)
    .single();

  if (fetchError || !shipment) return 'Error: Shipment not found';

  const s = shipment as Shipment;
  const generated = await generateEmail({
    shipment: s,
    origin: s.origin_contact ?? undefined,
    destination: s.destination_contact ?? undefined,
    carrier: s.carrier ?? undefined,
    draftType: input.draft_type,
    customInstructions: input.custom_instructions,
  });

  const { data: draft, error: insertError } = await supabase
    .from('email_drafts')
    .insert({
      shipment_id: input.shipment_id,
      draft_type: input.draft_type,
      recipient_email: input.recipient_email,
      cc_emails: input.cc_emails ?? [],
      subject: generated.subject,
      body: generated.body,
      status: 'draft',
      generated_by: 'claude',
    })
    .select()
    .single();

  if (insertError) return `Error saving draft: ${insertError.message}`;

  await supabase.from('automation_logs').insert({
    event_type: 'ai_email_draft',
    shipment_id: input.shipment_id,
    details: { draft_type: input.draft_type, draft_id: draft.id, source: 'agent' },
    status: 'success',
  });

  return JSON.stringify({
    draft_id: draft.id,
    subject: draft.subject,
    body: draft.body,
    recipient_email: draft.recipient_email,
    cc_emails: draft.cc_emails,
  });
}

export async function execSendEmailWithAttachment(input: {
  email_draft_id: string;
  attachment_file_id?: string;
  attachment_name?: string;
  attachment_mime?: string;
  fileBuffers?: Record<string, string>;
}): Promise<string> {
  const supabase = createServerSupabaseClient();

  const { data: draft, error } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('id', input.email_draft_id)
    .single();

  if (error || !draft) return 'Error: Email draft not found';

  const auth = new (await import('googleapis')).google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    subject: process.env.GMAIL_USER_EMAIL,
  });

  const gmail = google.gmail({ version: 'v1', auth });
  const boundary = 'fz_boundary_' + Date.now();

  const headerLines = [
    `To: ${draft.recipient_email}`,
    draft.cc_emails?.length ? `Cc: ${(draft.cc_emails as string[]).join(', ')}` : '',
    `Subject: ${draft.subject}`,
    `MIME-Version: 1.0`,
  ].filter(Boolean);

  let rawMime: string;

  const attachmentBase64 =
    input.attachment_file_id && input.fileBuffers
      ? input.fileBuffers[input.attachment_file_id]
      : null;

  if (attachmentBase64 && input.attachment_name) {
    headerLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    rawMime = [
      headerLines.join('\r\n'),
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      draft.body,
      '',
      `--${boundary}`,
      `Content-Type: ${input.attachment_mime ?? 'application/octet-stream'}; name="${input.attachment_name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${input.attachment_name}"`,
      '',
      attachmentBase64,
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    headerLines.push('Content-Type: text/plain; charset=utf-8');
    rawMime = [headerLines.join('\r\n'), '', draft.body].join('\r\n');
  }

  const encoded = Buffer.from(rawMime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const sendResponse = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });

  const gmailMessageId = sendResponse.data.id ?? '';

  await supabase
    .from('email_drafts')
    .update({ status: 'sent', sent_at: new Date().toISOString(), gmail_message_id: gmailMessageId })
    .eq('id', input.email_draft_id);

  await supabase.from('automation_logs').insert({
    event_type: 'email_sent',
    details: {
      draft_id: input.email_draft_id,
      gmail_message_id: gmailMessageId,
      source: 'agent',
      had_attachment: !!attachmentBase64,
    },
    status: 'success',
  });

  return JSON.stringify({ gmail_message_id: gmailMessageId, status: 'sent' });
}

// ---- Preview payload builders ----

async function buildPreviewPayload(
  sessionId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<PreviewPayload> {
  if (toolName === 'create_shipment') {
    const supabase = createServerSupabaseClient();
    const input = toolInput as {
      origin_contact_id: string;
      destination_contact_id: string;
      carrier_id?: string;
      description: string;
      weight_kg?: number;
      value_usd?: number;
      currency?: string;
      incoterm?: string;
      special_handling?: string;
    };

    const ids = [
      input.origin_contact_id,
      input.destination_contact_id,
      input.carrier_id,
    ].filter(Boolean) as string[];

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, city, country')
      .in('id', ids);

    const byId = Object.fromEntries((contacts ?? []).map((c) => [c.id, c]));
    const name = (id?: string) => {
      if (!id) return 'N/A';
      const c = byId[id];
      return c ? `${c.name}${c.city ? `, ${c.city}` : ''}` : id;
    };

    return {
      session_id: sessionId,
      tool: 'create_shipment',
      summary: `Create shipment: ${input.description}`,
      details: {
        shipment: {
          description: input.description,
          origin: name(input.origin_contact_id),
          destination: name(input.destination_contact_id),
          carrier: name(input.carrier_id),
          weight_kg: input.weight_kg ?? null,
          value: input.value_usd
            ? `${input.value_usd} ${input.currency ?? 'EUR'}`
            : 'N/A',
          incoterm: input.incoterm ?? null,
          special_handling: input.special_handling ?? null,
        },
      },
    };
  }

  // send_email_with_attachment
  const supabase = createServerSupabaseClient();
  const input = toolInput as {
    email_draft_id: string;
    attachment_name?: string;
  };

  const { data: draft } = await supabase
    .from('email_drafts')
    .select('subject, body, recipient_email, cc_emails')
    .eq('id', input.email_draft_id)
    .single();

  return {
    session_id: sessionId,
    tool: 'send_email_with_attachment',
    summary: draft
      ? `Send email: "${draft.subject}" → ${draft.recipient_email}`
      : 'Send email',
    details: {
      email: draft
        ? {
            to: draft.recipient_email,
            cc: draft.cc_emails ?? [],
            subject: draft.subject,
            body: draft.body,
            attachment_name: input.attachment_name,
          }
        : undefined,
    },
  };
}

// ---- Agent loop ----

interface RunAgentLoopResult {
  finalMessages: Anthropic.MessageParam[];
  finalText: string | null;
  stoppedAtGate: boolean;
  pendingToolName: string | null;
  pendingToolInput: Record<string, unknown> | null;
  pendingToolUseId: string | null;
  fileBuffers: Record<string, string>;
  steps: AgentStep[];
}

export async function runAgentLoop(
  messages: Anthropic.MessageParam[],
  fileBuffers: Record<string, string> = {},
): Promise<RunAgentLoopResult> {
  const client = getClient();
  const steps: AgentStep[] = [];
  let iterCount = 0;
  const MAX_ITER = 20;

  while (iterCount < MAX_ITER) {
    iterCount++;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: AGENT_SYSTEM_PROMPT,
      tools: AGENT_TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn') {
      const text = response.content.find((b) => b.type === 'text')?.text ?? null;
      return {
        finalMessages: messages,
        finalText: text,
        stoppedAtGate: false,
        pendingToolName: null,
        pendingToolInput: null,
        pendingToolUseId: null,
        fileBuffers,
        steps,
      };
    }

    if (response.stop_reason !== 'tool_use') {
      const text = response.content.find((b) => b.type === 'text')?.text ?? null;
      return {
        finalMessages: messages,
        finalText: text,
        stoppedAtGate: false,
        pendingToolName: null,
        pendingToolInput: null,
        pendingToolUseId: null,
        fileBuffers,
        steps,
      };
    }

    // Process all tool_use blocks in this response
    const assistantMsg: Anthropic.MessageParam = { role: 'assistant', content: response.content };
    messages = [...messages, assistantMsg];

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      const { id: toolUseId, name: toolName, input: toolInput } = block;
      const input = toolInput as Record<string, unknown>;

      // Check preview gate
      if (PREVIEW_GATE_TOOLS.has(toolName)) {
        // Add a running step for the gated tool
        steps.push({
          id: toolUseId,
          tool: toolName,
          label: toolName === 'create_shipment'
            ? `Create shipment: ${(input.description as string) ?? ''}`
            : `Send email`,
          status: 'pending_approval',
        });

        return {
          finalMessages: messages,
          finalText: null,
          stoppedAtGate: true,
          pendingToolName: toolName,
          pendingToolInput: input,
          pendingToolUseId: toolUseId,
          fileBuffers,
          steps,
        };
      }

      // Execute read tool immediately
      const stepId = toolUseId;
      steps.push({ id: stepId, tool: toolName, label: toolLabelFor(toolName, input), status: 'running' });

      let resultText: string;
      try {
        resultText = await dispatchReadTool(toolName, input, fileBuffers);
      } catch (err) {
        resultText = `Error: ${String(err)}`;
      }

      const step = steps.find((s) => s.id === stepId);
      if (step) {
        step.status = 'done';
        step.result_summary = summarizeResult(toolName, resultText);
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: resultText,
      });
    }

    if (toolResults.length > 0) {
      messages = [...messages, { role: 'user', content: toolResults }];
    }
  }

  return {
    finalMessages: messages,
    finalText: 'Agent reached maximum iterations.',
    stoppedAtGate: false,
    pendingToolName: null,
    pendingToolInput: null,
    pendingToolUseId: null,
    fileBuffers,
    steps,
  };
}

async function dispatchReadTool(
  toolName: string,
  input: Record<string, unknown>,
  fileBuffers: Record<string, string>,
): Promise<string> {
  switch (toolName) {
    case 'search_contacts':
      return execSearchContacts(input as { query?: string; contact_type?: string });
    case 'find_drive_file':
      return execFindDriveFile(
        input as { name_contains: string; modified_after?: string; modified_before?: string; mime_type?: string },
      );
    case 'download_drive_file':
      return execDownloadDriveFile(
        input as { file_id: string; file_name: string },
        fileBuffers,
      );
    case 'generate_email_draft':
      return execGenerateEmailDraft(
        input as {
          shipment_id: string;
          draft_type: 'booking' | 'customs' | 'load_request' | 'notification';
          recipient_email: string;
          cc_emails?: string[];
          custom_instructions?: string;
        },
      );
    default:
      return `Unknown tool: ${toolName}`;
  }
}

function toolLabelFor(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'search_contacts': {
      const parts = [];
      if (input.query) parts.push(`"${input.query}"`);
      if (input.contact_type) parts.push(`(${input.contact_type})`);
      return `Search contacts${parts.length ? ': ' + parts.join(' ') : ''}`;
    }
    case 'find_drive_file':
      return `Find Drive file: "${input.name_contains}"`;
    case 'download_drive_file':
      return `Download ${input.file_name ?? input.file_id}`;
    case 'generate_email_draft':
      return `Generate ${input.draft_type ?? ''} email draft`;
    default:
      return toolName;
  }
}

function summarizeResult(toolName: string, resultText: string): string {
  try {
    const parsed = JSON.parse(resultText);
    if (toolName === 'search_contacts' && Array.isArray(parsed)) {
      if (parsed.length === 0) return 'No contacts found';
      return parsed.map((c: { name: string; email: string }) => `${c.name} (${c.email})`).join(', ');
    }
    if (toolName === 'find_drive_file' && Array.isArray(parsed)) {
      if (parsed.length === 0) return 'No files found';
      return parsed.map((f: { name: string }) => f.name).join(', ');
    }
    if (toolName === 'download_drive_file') {
      return `Downloaded ${parsed.file_name} (${parsed.size_kb} KB)`;
    }
    if (toolName === 'generate_email_draft') {
      return `Draft ready: "${parsed.subject}"`;
    }
  } catch {
    // fall through
  }
  if (resultText.startsWith('Error')) return resultText;
  return resultText.slice(0, 80);
}

export { buildPreviewPayload };
