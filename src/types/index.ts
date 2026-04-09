// ============================================================
// Freshzilla Supply Chain Automation — Type Definitions
// ============================================================

// ---- Enums ----

export type UserRole = 'admin' | 'user' | 'warehouse' | 'finance' | 'viewer';

export type ContactType = 'warehouse' | 'carrier' | 'broker' | 'customer';

export type ShipmentStatus = 'draft' | 'pending_approval' | 'sent' | 'confirmed' | 'delivered';

export type DraftType = 'booking' | 'customs' | 'load_request' | 'notification';

export type DraftStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'rejected';

export type GeneratedBy = 'claude' | 'template' | 'manual';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type LogStatus = 'success' | 'error' | 'pending';

export type MessageRole = 'user' | 'assistant';

export type Incoterm = 'FCA' | 'CIF' | 'FOB' | 'EXW' | 'DDP' | 'DAP' | 'CPT' | 'CIP';

// ---- Database Row Types ----

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  type: ContactType;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  is_active: boolean;
  google_sheets_row_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SafeCubeEvent {
  location: { name: string; country: string | null; locode: string | null } | null;
  facility: string | null;
  eventType: string;
  eventCode: string;
  date: string;
  isActual: boolean;
  description: string | null;
}

export interface Shipment {
  id: string;
  reference: string;
  status: ShipmentStatus;
  origin_contact_id: string | null;
  destination_contact_id: string | null;
  carrier_id: string | null;
  description: string;
  weight_kg: number | null;
  volume_cbm: number | null;
  value_usd: number | null;
  currency: string;
  hs_code: string | null;
  incoterm: Incoterm | null;
  special_handling: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  google_sheets_row_id: string | null;
  drive_folder_id: string | null;
  // Container tracking
  container_number: string | null;
  sealine_scac: string | null;
  tracking_status: string | null;
  tracking_eta: string | null;
  tracking_updated_at: string | null;
  tracking_events: SafeCubeEvent[] | null;
  // Tracking table fields
  po_number: string | null;
  product: string | null;
  supplier: string | null;
  loading_status: string | null;
  company: string | null;
  // Joined relations
  origin_contact?: Contact;
  destination_contact?: Contact;
  carrier?: Contact;
}

export interface EmailDraft {
  id: string;
  shipment_id: string | null;
  draft_type: DraftType;
  recipient_email: string;
  cc_emails: string[];
  subject: string;
  body: string;
  status: DraftStatus;
  generated_by: GeneratedBy;
  approved_by: string | null;
  sent_at: string | null;
  gmail_message_id: string | null;
  created_at: string;
  // Joined
  shipment?: Shipment;
}

export interface Conversation {
  id: string;
  user_id: string;
  shipment_id: string | null;
  title: string;
  created_at: string;
  // Joined
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

export interface AutomationLog {
  id: string;
  event_type: string;
  shipment_id: string | null;
  user_id: string | null;
  details: Record<string, unknown>;
  status: LogStatus;
  error_message: string | null;
  created_at: string;
}

export interface Approval {
  id: string;
  email_draft_id: string;
  requested_by: string;
  assigned_to: string;
  status: ApprovalStatus;
  comment: string | null;
  created_at: string;
  decided_at: string | null;
  // Joined
  email_draft?: EmailDraft;
}

// ---- API Request/Response Types ----

export interface CreateShipmentRequest {
  origin_contact_id: string;
  destination_contact_id: string;
  carrier_id?: string;
  description: string;
  weight_kg?: number;
  volume_cbm?: number;
  value_usd?: number;
  currency?: string;
  hs_code?: string;
  incoterm?: Incoterm;
  special_handling?: string;
  container_number?: string;
  sealine_scac?: string;
}

export interface GenerateEmailRequest {
  shipment_id: string;
  draft_type: DraftType;
  recipient_email: string;
  cc_emails?: string[];
  custom_instructions?: string;
}

export interface AIChatRequest {
  conversation_id?: string;
  message: string;
}

export interface AIChatResponse {
  conversation_id: string;
  message: Message;
  actions?: AIAction[];
}

export interface AIAction {
  type: 'create_shipment' | 'generate_email' | 'create_draft' | 'generate_pdf';
  description: string;
  data: Record<string, unknown>;
}

// ---- Dashboard Stats ----

export interface DashboardStats {
  total_shipments: number;
  shipments_this_month: number;
  pending_approvals: number;
  emails_sent_today: number;
  active_contacts: number;
  ai_conversations: number;
  recent_shipments: Shipment[];
  recent_emails: EmailDraft[];
}

// ---- Agent API Types ----

export type { AgentStep, AgentStatus, AgentRunState, PreviewPayload, AgentResponse, AgentCompleteResponse, AgentNeedsApprovalResponse } from '@/lib/agent-types';

// ---- Component Props ----

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: number;
}
