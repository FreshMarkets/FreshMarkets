import Anthropic from '@anthropic-ai/sdk';
import type { Shipment, Contact, DraftType } from '@/types';

let client: Anthropic | null = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');
  client = new Anthropic({ apiKey });
  return client;
}

// ---- Email Generation ----

const EMAIL_SYSTEM_PROMPT = `You are a professional supply chain coordinator for Freshzilla, an international fresh produce logistics company.
Your job is to draft professional, clear, concise emails for shipment bookings, customs declarations, load requests, and notifications.
Always be polite, specific with dates/weights/values, and include all relevant reference numbers.
Format the email body only — no subject line, no greeting/signature unless specifically asked.
Keep emails under 250 words unless the content requires more detail.`;

export async function generateEmail(opts: {
  shipment: Shipment;
  origin?: Contact;
  destination?: Contact;
  carrier?: Contact;
  draftType: DraftType;
  customInstructions?: string;
}): Promise<{ subject: string; body: string }> {
  const { shipment, origin, destination, carrier, draftType, customInstructions } = opts;

  const contextLines: string[] = [
    `Shipment Reference: ${shipment.reference}`,
    `Description: ${shipment.description}`,
    origin ? `Origin: ${origin.name}, ${origin.city}, ${origin.country}` : '',
    destination ? `Destination: ${destination.name}, ${destination.city}, ${destination.country}` : '',
    carrier ? `Carrier: ${carrier.name} (${carrier.email})` : '',
    shipment.weight_kg ? `Weight: ${shipment.weight_kg} kg` : '',
    shipment.volume_cbm ? `Volume: ${shipment.volume_cbm} CBM` : '',
    shipment.value_usd ? `Value: ${shipment.value_usd} ${shipment.currency}` : '',
    shipment.hs_code ? `HS Code: ${shipment.hs_code}` : '',
    shipment.incoterm ? `Incoterm: ${shipment.incoterm}` : '',
    shipment.special_handling ? `Special Handling: ${shipment.special_handling}` : '',
  ].filter(Boolean);

  const draftTypeMap: Record<DraftType, string> = {
    booking: 'booking confirmation email to the carrier',
    customs: 'customs declaration cover email to the customs broker',
    load_request: 'load/pickup request email to the warehouse',
    notification: 'status notification email to the customer',
  };

  const prompt = `Draft a ${draftTypeMap[draftType]}.

Shipment details:
${contextLines.join('\n')}

${customInstructions ? `Additional instructions: ${customInstructions}` : ''}

Return your response as JSON: { "subject": "...", "body": "..." }`;

  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: EMAIL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Fallback
  }

  return {
    subject: `[Freshzilla] ${shipment.reference} — ${draftType}`,
    body: text,
  };
}

// ---- AI Chat ----

const CHAT_SYSTEM_PROMPT = `You are Freshzilla AI, an intelligent supply chain assistant.
You help users manage shipments, draft emails, create customs documents, and analyze logistics data.
When a user describes a shipment, extract the key details (origin, destination, carrier, weight, value, etc).
If you need to create a shipment, draft an email, or generate a document, include a JSON action block:
\`\`\`action
{ "type": "create_shipment" | "generate_email" | "generate_pdf", "data": { ... } }
\`\`\`
Be conversational but efficient. Ask for clarification if key details are missing.`;

export async function chat(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: CHAT_SYSTEM_PROMPT,
    messages,
  });

  return response.content[0].type === 'text' ? response.content[0].text : '';
}
