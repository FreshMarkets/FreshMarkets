// ============================================================
// Agent-first architecture types
// ============================================================

import type Anthropic from '@anthropic-ai/sdk';

export type AgentStepStatus = 'running' | 'done' | 'pending_approval' | 'cancelled';

export interface AgentStep {
  id: string;
  tool: string;
  label: string;
  status: AgentStepStatus;
  result_summary?: string;
}

export interface ShipmentPreviewDetails {
  description: string;
  origin: string;
  destination: string;
  carrier: string;
  weight_kg: number | null;
  value: string;
  incoterm: string | null;
  special_handling: string | null;
}

export interface EmailPreviewDetails {
  to: string;
  cc: string[];
  subject: string;
  body: string;
  attachment_name?: string;
}

export interface PreviewPayload {
  session_id: string;
  tool: 'create_shipment' | 'send_email_with_attachment';
  summary: string;
  details: {
    shipment?: ShipmentPreviewDetails;
    email?: EmailPreviewDetails;
  };
}

export type AgentStatus = 'idle' | 'running' | 'needs_approval' | 'complete' | 'error';

export interface AgentRunState {
  status: AgentStatus;
  steps: AgentStep[];
  preview: PreviewPayload | null;
  sessionId: string | null;
  conversationId: string | null;
}

// Shape stored in agent_sessions.messages_json
export type AgentMessages = Anthropic.MessageParam[];

export interface AgentSessionRow {
  id: string;
  conversation_id: string | null;
  messages_json: AgentMessages;
  pending_tool: string;
  pending_inputs: Record<string, unknown>;
  file_buffers: Record<string, string> | null;
  status: 'pending' | 'executed' | 'cancelled';
  created_at: string;
  expires_at: string;
}

// Response shapes from /api/ai/agent and /api/ai/agent/execute
export interface AgentCompleteResponse {
  status: 'complete';
  conversation_id: string;
  steps: AgentStep[];
  message: string;
}

export interface AgentNeedsApprovalResponse {
  status: 'needs_approval';
  conversation_id: string;
  session_id: string;
  preview: PreviewPayload;
  steps: AgentStep[];
}

export type AgentResponse = AgentCompleteResponse | AgentNeedsApprovalResponse;
