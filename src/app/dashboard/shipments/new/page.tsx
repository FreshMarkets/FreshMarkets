'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Package,
  MapPin,
  Truck,
  FileText,
  Weight,
  DollarSign,
  Sparkles,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import type { Contact, Incoterm, DraftType } from '@/types';

const INCOTERMS: Incoterm[] = ['FCA', 'CIF', 'FOB', 'EXW', 'DDP', 'DAP', 'CPT', 'CIP'];
const DRAFT_TYPES: { label: string; value: DraftType }[] = [
  { label: 'Booking (to carrier)', value: 'booking' },
  { label: 'Customs (to broker)', value: 'customs' },
  { label: 'Load Request (to warehouse)', value: 'load_request' },
  { label: 'Notification (to customer)', value: 'notification' },
];

export default function NewShipmentPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string } | null>(null);
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<DraftType>('booking');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [createdShipmentId, setCreatedShipmentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/contacts')
      .then((r) => r.json())
      .then((data) => setContacts(Array.isArray(data) ? data : []))
      .finally(() => setLoadingContacts(false));
  }, []);

  const [form, setForm] = useState({
    description: '',
    origin_contact_id: '',
    destination_contact_id: '',
    carrier_id: '',
    weight_kg: '',
    volume_cbm: '',
    value_usd: '',
    currency: 'EUR',
    hs_code: '',
    incoterm: '' as Incoterm | '',
    special_handling: '',
    container_number: '',
    sealine_scac: '',
  });

  const update = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Resolve recipient email based on draft type
  const getAutoRecipient = (): string => {
    switch (draftType) {
      case 'booking': {
        const carrier = contacts.find((c) => c.id === form.carrier_id);
        return carrier?.email || '';
      }
      case 'load_request': {
        const origin = contacts.find((c) => c.id === form.origin_contact_id);
        return origin?.email || '';
      }
      case 'notification':
      case 'customs': {
        const dest = contacts.find((c) => c.id === form.destination_contact_id);
        return dest?.email || '';
      }
      default:
        return '';
    }
  };

  // Auto-fill recipient when draft type or contacts change
  useEffect(() => {
    const auto = getAutoRecipient();
    if (auto) setRecipientEmail(auto);
  }, [draftType, form.carrier_id, form.origin_contact_id, form.destination_contact_id]);

  const createShipmentPayload = () => ({
    ...form,
    weight_kg: form.weight_kg ? Number(form.weight_kg) : undefined,
    volume_cbm: form.volume_cbm ? Number(form.volume_cbm) : undefined,
    value_usd: form.value_usd ? Number(form.value_usd) : undefined,
    incoterm: form.incoterm || undefined,
    carrier_id: form.carrier_id || undefined,
    container_number: form.container_number || undefined,
    sealine_scac: form.sealine_scac || undefined,
  });

  const handleCreateShipment = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createShipmentPayload()),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create shipment');
      }
      router.push('/dashboard/shipments');
    } catch (err) {
      setError(String(err));
      setSending(false);
    }
  };

  const handleGenerateEmail = async () => {
    setGenerating(true);
    setError(null);
    setSavedDraftId(null);

    try {
      // Step 1: Create the shipment (or reuse existing)
      let shipmentId = createdShipmentId;
      if (!shipmentId) {
        const shipRes = await fetch('/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(createShipmentPayload()),
        });
        if (!shipRes.ok) {
          const err = await shipRes.json();
          throw new Error(err.error || 'Failed to create shipment');
        }
        const shipment = await shipRes.json();
        shipmentId = shipment.id;
        setCreatedShipmentId(shipmentId);
      }

      // Step 2: Generate the email draft via Claude
      if (!recipientEmail) {
        throw new Error('Please enter a recipient email address');
      }

      const draftRes = await fetch('/api/emails/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipment_id: shipmentId,
          draft_type: draftType,
          recipient_email: recipientEmail,
        }),
      });
      if (!draftRes.ok) {
        const err = await draftRes.json();
        throw new Error(err.error || 'Failed to generate email');
      }
      const draft = await draftRes.json();

      setEmailPreview({ subject: draft.subject, body: draft.body });
      setSavedDraftId(draft.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleSendDraft = async () => {
    if (!savedDraftId) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/emails/${savedDraftId}/send`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send email');
      }
      router.push('/dashboard/emails');
    } catch (err) {
      setError(String(err));
      setSending(false);
    }
  };

  const warehouses = contacts.filter((c) => c.type === 'warehouse');
  const destinations = contacts.filter(
    (c) => c.type === 'customer' || c.type === 'warehouse' || c.type === 'broker',
  );
  // Include all contact types that could act as carrier (carrier + warehouse with transport)
  const carriers = contacts.filter((c) => c.type === 'carrier' || c.type === 'warehouse');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 animate-fade-in-up animate-fade-in-up-1">
        <Link href="/dashboard/shipments" className="btn-ghost p-2">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Shipment</h1>
          <p className="text-sm text-[var(--color-fz-text-muted)]">
            Fill in the details and generate emails with AI
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Form */}
        <div className="lg:col-span-3 space-y-6 animate-fade-in-up animate-fade-in-up-2">
          {/* Description */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Package size={16} className="text-[#00A082]" />
              Shipment Details
            </h3>
            <div>
              <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Description *</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="e.g. Fresh organic avocados — 120 pallets"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">HS Code</label>
                <input
                  className="input"
                  placeholder="e.g. 0804.40"
                  value={form.hs_code}
                  onChange={(e) => update('hs_code', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Incoterm</label>
                <select
                  className="input"
                  value={form.incoterm}
                  onChange={(e) => update('incoterm', e.target.value)}
                >
                  <option value="">Select...</option>
                  {INCOTERMS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Special Handling</label>
              <input
                className="input"
                placeholder="e.g. Temperature controlled (2-8°C)"
                value={form.special_handling}
                onChange={(e) => update('special_handling', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[var(--color-fz-border)]">
              <div>
                <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Container / BL / BK №</label>
                <input
                  className="input font-mono"
                  placeholder="e.g. MSCU1234567"
                  value={form.container_number}
                  onChange={(e) => update('container_number', e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Sealine SCAC</label>
                <input
                  className="input font-mono"
                  placeholder="e.g. MSCU, MAEU"
                  value={form.sealine_scac}
                  onChange={(e) => update('sealine_scac', e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          {/* Route */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <MapPin size={16} className="text-[#FF9500]" />
              Route
            </h3>
            <div>
              <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Origin (Warehouse)</label>
              <select
                className="input"
                value={form.origin_contact_id}
                onChange={(e) => update('origin_contact_id', e.target.value)}
              >
                <option value="">{loadingContacts ? 'Loading...' : 'Select origin...'}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} — {w.city}, {w.country}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Destination</label>
              <select
                className="input"
                value={form.destination_contact_id}
                onChange={(e) => update('destination_contact_id', e.target.value)}
              >
                <option value="">{loadingContacts ? 'Loading...' : 'Select destination...'}</option>
                {destinations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.city}, {d.country}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Carrier</label>
              <select
                className="input"
                value={form.carrier_id}
                onChange={(e) => update('carrier_id', e.target.value)}
              >
                <option value="">{loadingContacts ? 'Loading...' : 'Select carrier...'}</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.city}, {c.country}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Metrics */}
          <div className="glass-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              <Weight size={16} className="text-[#FFC244]" />
              Weight, Volume & Value
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Weight (kg)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={form.weight_kg}
                  onChange={(e) => update('weight_kg', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Volume (CBM)</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={form.volume_cbm}
                  onChange={(e) => update('volume_cbm', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-[var(--color-fz-text-muted)] mb-1.5 block">Value ({form.currency})</label>
                <input
                  className="input"
                  type="number"
                  placeholder="0"
                  value={form.value_usd}
                  onChange={(e) => update('value_usd', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Email Preview Panel */}
        <div className="lg:col-span-2 space-y-4 animate-fade-in-up animate-fade-in-up-3">
          <div className="glass-card p-6 sticky top-24">
            <h3 className="font-semibold flex items-center gap-2 text-sm mb-4">
              <Sparkles size={16} className="text-[#00A082]" />
              AI Email Draft
            </h3>

            <div className="mb-4 space-y-3">
              <div>
                <label className="text-xs text-[var(--color-fz-text-muted)] mb-1.5 block">Email Type</label>
                <select
                  className="input text-sm"
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value as DraftType)}
                >
                  {DRAFT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--color-fz-text-muted)] mb-1.5 block">Recipient Email</label>
                <input
                  className="input text-sm"
                  type="email"
                  placeholder="recipient@example.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 text-xs text-[#D93636]">
                {error}
              </div>
            )}

            {!emailPreview ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-2xl bg-[#00A082]/10 flex items-center justify-center text-[#00A082] mx-auto mb-4">
                  <Sparkles size={24} />
                </div>
                <p className="text-sm text-[var(--color-fz-text-muted)] mb-4">
                  Fill in the shipment details, then click below to generate a professional email with Claude AI.
                </p>
                <button
                  className="btn-primary w-full justify-center"
                  onClick={handleGenerateEmail}
                  disabled={generating || !form.description || !recipientEmail}
                >
                  {generating ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Create & Generate Email
                    </>
                  )}
                </button>
                <button
                  className="btn-secondary w-full justify-center mt-2"
                  onClick={handleCreateShipment}
                  disabled={sending || !form.description}
                >
                  {sending ? 'Creating...' : 'Save Shipment Only'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-[var(--color-fz-text-muted)] mb-1 block">Subject</label>
                  <input className="input text-sm" value={emailPreview.subject} readOnly />
                </div>
                <div>
                  <label className="text-xs text-[var(--color-fz-text-muted)] mb-1 block">Body</label>
                  <textarea
                    className="input text-sm min-h-[260px] resize-none font-mono leading-relaxed"
                    value={emailPreview.body}
                    onChange={(e) =>
                      setEmailPreview((prev) =>
                        prev ? { ...prev, body: e.target.value } : null,
                      )
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1 justify-center"
                    onClick={handleSendDraft}
                    disabled={sending || !savedDraftId}
                  >
                    {sending ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {sending ? 'Sending...' : 'Send via Gmail'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setEmailPreview(null)}
                  >
                    Clear
                  </button>
                </div>
                <button
                  className="btn-ghost text-xs w-full justify-center"
                  onClick={handleGenerateEmail}
                  disabled={generating}
                >
                  <Sparkles size={14} />
                  Regenerate
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
