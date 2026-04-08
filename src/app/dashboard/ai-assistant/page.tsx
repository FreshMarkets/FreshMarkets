'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  Mail,
  AlertCircle,
} from 'lucide-react';
import type { AgentResponse, AgentStep, PreviewPayload } from '@/types';

// ---- Types ----

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'preview' | 'error';
  content: string;
  timestamp: Date;
  steps?: AgentStep[];
  preview?: PreviewPayload;
  sessionId?: string;
}

type AgentStatus = 'idle' | 'running' | 'needs_approval' | 'complete' | 'error';

// ---- Suggestions ----

const SUGGESTIONS = [
  'Book a DPD shipment from Barcelona to Stockholm, 50kg avocados worth €2,000',
  'Send a customs declaration email to Eurobrokers for shipment FZ-260322-C9XW',
  'What shipments are pending approval right now?',
  'Generate a load request for warehouse pickup tomorrow morning',
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '0',
    role: 'assistant',
    content:
      "👋 Hey there! I'm **Freshzilla Agent**, your autonomous supply chain assistant.\n\nI can **fully execute** multi-step tasks like:\n- 📦 Book a shipment end-to-end — find carrier, create record, send email\n- 📎 Attach last month's invoice from Drive automatically\n- 📬 CC the customs broker and draft the customs email\n- 📊 Check shipment status and pending approvals\n\nI'll always show you a **preview before sending emails or creating records**. Just describe what you need!",
    timestamp: new Date(),
  },
];

// ---- Sub-components ----

function AgentStepList({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {steps.map((step) => (
        <div key={step.id} className="flex items-start gap-2 text-xs">
          {step.status === 'running' && (
            <Loader2 size={13} className="animate-spin text-[#FF9500] mt-0.5 shrink-0" />
          )}
          {step.status === 'done' && (
            <CheckCircle size={13} className="text-[#00A082] mt-0.5 shrink-0" />
          )}
          {step.status === 'pending_approval' && (
            <Clock size={13} className="text-[#B8860B] mt-0.5 shrink-0" />
          )}
          {step.status === 'cancelled' && (
            <XCircle size={13} className="text-[#D93636] mt-0.5 shrink-0" />
          )}
          <div>
            <span
              className={
                step.status === 'done'
                  ? 'text-[var(--color-fz-text-secondary)]'
                  : step.status === 'pending_approval'
                  ? 'text-[#B8860B]'
                  : 'text-[var(--color-fz-text-muted)]'
              }
            >
              {step.label}
            </span>
            {step.result_summary && (
              <span className="text-[var(--color-fz-text-muted)] ml-1">
                → {step.result_summary}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShipmentPreviewCard({
  preview,
  onApprove,
  onCancel,
  isLoading,
}: {
  preview: PreviewPayload;
  onApprove: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const s = preview.details.shipment;
  if (!s) return null;

  return (
    <div className="mt-3 border border-[#FFC244]/30 rounded-xl p-4 bg-[#FFC244]/5">
      <div className="flex items-center gap-2 mb-3">
        <Package size={14} className="text-[#B8860B]" />
        <span className="text-xs font-semibold text-[#B8860B]">Preview: Create Shipment</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-4">
        <div>
          <span className="text-[var(--color-fz-text-muted)]">Description</span>
          <p className="text-[var(--color-fz-text)]">{s.description}</p>
        </div>
        <div>
          <span className="text-[var(--color-fz-text-muted)]">Value</span>
          <p className="text-[var(--color-fz-text)]">{s.value}</p>
        </div>
        <div>
          <span className="text-[var(--color-fz-text-muted)]">Origin</span>
          <p className="text-[var(--color-fz-text)]">{s.origin}</p>
        </div>
        <div>
          <span className="text-[var(--color-fz-text-muted)]">Destination</span>
          <p className="text-[var(--color-fz-text)]">{s.destination}</p>
        </div>
        <div>
          <span className="text-[var(--color-fz-text-muted)]">Carrier</span>
          <p className="text-[var(--color-fz-text)]">{s.carrier}</p>
        </div>
        <div>
          <span className="text-[var(--color-fz-text-muted)]">Weight</span>
          <p className="text-[var(--color-fz-text)]">{s.weight_kg ? `${s.weight_kg} kg` : 'N/A'}</p>
        </div>
        {s.incoterm && (
          <div>
            <span className="text-[var(--color-fz-text-muted)]">Incoterm</span>
            <p className="text-[var(--color-fz-text)]">{s.incoterm}</p>
          </div>
        )}
        {s.special_handling && (
          <div className="col-span-2">
            <span className="text-[var(--color-fz-text-muted)]">Special Handling</span>
            <p className="text-[var(--color-fz-text)]">{s.special_handling}</p>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="btn-primary py-1.5 px-4 text-xs rounded-lg flex items-center gap-1.5"
        >
          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
          Create Shipment
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="py-1.5 px-4 text-xs rounded-lg border border-[var(--color-fz-border)] text-[var(--color-fz-text-secondary)] hover:text-[var(--color-fz-text)] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EmailPreviewCard({
  preview,
  onApprove,
  onCancel,
  isLoading,
}: {
  preview: PreviewPayload;
  onApprove: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const e = preview.details.email;
  if (!e) return null;

  return (
    <div className="mt-3 border border-[#00A082]/30 rounded-xl p-4 bg-[#00A082]/5">
      <div className="flex items-center gap-2 mb-3">
        <Mail size={14} className="text-[#00A082]" />
        <span className="text-xs font-semibold text-[#008A6E]">Preview: Send Email</span>
      </div>
      <div className="space-y-1.5 text-xs mb-3">
        <div className="flex gap-2">
          <span className="text-[var(--color-fz-text-muted)] w-8 shrink-0">To</span>
          <span className="text-[var(--color-fz-text)]">{e.to}</span>
        </div>
        {e.cc.length > 0 && (
          <div className="flex gap-2">
            <span className="text-[var(--color-fz-text-muted)] w-8 shrink-0">CC</span>
            <span className="text-[var(--color-fz-text)]">{e.cc.join(', ')}</span>
          </div>
        )}
        <div className="flex gap-2">
          <span className="text-[var(--color-fz-text-muted)] w-8 shrink-0">Re</span>
          <span className="text-[var(--color-fz-text)] font-medium">{e.subject}</span>
        </div>
        {e.attachment_name && (
          <div className="flex gap-2">
            <span className="text-[var(--color-fz-text-muted)] w-8 shrink-0">📎</span>
            <span className="text-[#00A082]">{e.attachment_name}</span>
          </div>
        )}
      </div>
      <div className="bg-[var(--color-fz-surface-2)] rounded-lg p-3 text-xs text-[var(--color-fz-text-secondary)] whitespace-pre-wrap max-h-40 overflow-y-auto mb-4 font-mono">
        {e.body}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={isLoading}
          className="btn-primary py-1.5 px-4 text-xs rounded-lg flex items-center gap-1.5"
        >
          {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Approve & Send
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="py-1.5 px-4 text-xs rounded-lg border border-[var(--color-fz-border)] text-[var(--color-fz-text-secondary)] hover:text-[var(--color-fz-text)] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---- Main page ----

export default function AIAssistantPage() {
  return (
    <Suspense>
      <AIAssistantContent />
    </Suspense>
  );
}

function AIAssistantContent() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchParams = useSearchParams();
  const autoSentRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus]);

  const handleAgentResponse = (data: AgentResponse) => {
    if (!conversationId && data.conversation_id) {
      setConversationId(data.conversation_id);
    }

    if (data.status === 'needs_approval') {
      setMessages((prev) => [
        ...prev,
        {
          id: data.session_id,
          role: 'preview',
          content: data.preview.summary,
          timestamp: new Date(),
          steps: data.steps,
          preview: data.preview,
          sessionId: data.session_id,
        },
      ]);
      setAgentStatus('needs_approval');
    } else {
      // complete
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          steps: data.steps,
        },
      ]);
      setAgentStatus('complete');
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || agentStatus === 'running') return;

    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() },
      {
        id: 'thinking',
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        steps: [{ id: 'init', tool: '', label: 'Working...', status: 'running' }],
      },
    ]);
    setInput('');
    setAgentStatus('running');

    try {
      const res = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId ?? undefined, message: msg }),
      });

      const data: AgentResponse = await res.json();

      // Remove the thinking placeholder
      setMessages((prev) => prev.filter((m) => m.id !== 'thinking'));
      handleAgentResponse(data);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== 'thinking'));
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'error',
          content: 'Sorry, something went wrong. Please check your API configuration and try again.',
          timestamp: new Date(),
        },
      ]);
      setAgentStatus('error');
    }
  };

  // Auto-send message from ?q= param (navigated from /home chat bar)
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && !autoSentRef.current) {
      autoSentRef.current = true;
      sendMessage(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (sessionId: string) => {
    setApprovingId(sessionId);
    setAgentStatus('running');

    // Replace the preview card with a running indicator
    setMessages((prev) =>
      prev.map((m) =>
        m.id === sessionId
          ? {
              ...m,
              steps: [
                ...(m.steps ?? []).map((s) =>
                  s.status === 'pending_approval' ? { ...s, status: 'running' as const } : s,
                ),
              ],
            }
          : m,
      ),
    );

    try {
      const res = await fetch('/api/ai/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action: 'approve' }),
      });

      const data: AgentResponse = await res.json();

      // Remove the preview message
      setMessages((prev) => prev.filter((m) => m.id !== sessionId));
      handleAgentResponse(data);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== sessionId));
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'error',
          content: 'Failed to execute the action. Please try again.',
          timestamp: new Date(),
        },
      ]);
      setAgentStatus('error');
    } finally {
      setApprovingId(null);
    }
  };

  const handleCancel = async (sessionId: string) => {
    setApprovingId(sessionId);
    try {
      await fetch('/api/ai/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action: 'cancel' }),
      });
    } catch {
      // Best-effort
    }
    setMessages((prev) => prev.filter((m) => m.id !== sessionId));
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Action cancelled.',
        timestamp: new Date(),
      },
    ]);
    setAgentStatus('idle');
    setApprovingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isRunning = agentStatus === 'running';

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 animate-fade-in-up animate-fade-in-up-1">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00C49A] to-[#00A082] flex items-center justify-center shadow-lg shadow-[#00A082]/20">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Freshzilla Agent</h1>
          <p className="text-xs text-[var(--color-fz-text-muted)]">
            Powered by Claude · Autonomous multi-step execution with preview
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 animate-fade-in-up animate-fade-in-up-2">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex gap-3 justify-end">
                <div className="max-w-[80%] bg-[#00A082]/10 border border-[#00A082]/20 rounded-2xl rounded-br-md px-4 py-3">
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ __html: msg.content.replace(/\n/g, '<br />') }}
                  />
                </div>
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C49A] to-[#00A082] flex items-center justify-center shrink-0 mt-1">
                  <User size={14} className="text-white" />
                </div>
              </div>
            );
          }

          if (msg.role === 'error') {
            return (
              <div key={msg.id} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-[#FF4C4C]/10 border border-[#FF4C4C]/20 flex items-center justify-center shrink-0">
                  <AlertCircle size={14} className="text-[#D93636]" />
                </div>
                <div className="glass-card px-5 py-4 rounded-2xl rounded-bl-md max-w-[80%]">
                  <p className="text-sm text-[#D93636]">{msg.content}</p>
                </div>
              </div>
            );
          }

          if (msg.role === 'preview' && msg.preview) {
            const isApproving = approvingId === msg.sessionId;
            return (
              <div key={msg.id} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C49A] to-[#00A082] flex items-center justify-center shrink-0 mt-1">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="glass-card px-5 py-4 rounded-2xl rounded-bl-md max-w-[85%]">
                  <p className="text-sm text-[var(--color-fz-text-secondary)] mb-1">
                    I'm ready to proceed. Please review:
                  </p>
                  <AgentStepList steps={msg.steps ?? []} />
                  {msg.preview.tool === 'create_shipment' ? (
                    <ShipmentPreviewCard
                      preview={msg.preview}
                      onApprove={() => handleApprove(msg.sessionId!)}
                      onCancel={() => handleCancel(msg.sessionId!)}
                      isLoading={isApproving}
                    />
                  ) : (
                    <EmailPreviewCard
                      preview={msg.preview}
                      onApprove={() => handleApprove(msg.sessionId!)}
                      onCancel={() => handleCancel(msg.sessionId!)}
                      isLoading={isApproving}
                    />
                  )}
                </div>
              </div>
            );
          }

          // assistant
          return (
            <div key={msg.id} className="flex gap-3 items-start">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00C49A] to-[#00A082] flex items-center justify-center shrink-0 mt-1">
                {isRunning && msg.id === 'thinking' ? (
                  <Loader2 size={14} className="text-white animate-spin" />
                ) : (
                  <Bot size={14} className="text-white" />
                )}
              </div>
              <div className="glass-card px-5 py-4 rounded-2xl rounded-bl-md max-w-[85%]">
                {msg.content && (
                  <div
                    className="text-sm leading-relaxed whitespace-pre-wrap [&_strong]:font-semibold [&_strong]:text-[var(--color-fz-text)]"
                    dangerouslySetInnerHTML={{
                      __html: msg.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br />')
                        .replace(
                          /^> (.*)/gm,
                          '<blockquote class="border-l-2 border-[#00A082]/30 pl-3 my-1 text-[var(--color-fz-text-secondary)]">$1</blockquote>',
                        ),
                    }}
                  />
                )}
                {msg.steps && msg.steps.length > 0 && <AgentStepList steps={msg.steps} />}
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="grid sm:grid-cols-2 gap-2 mt-4 animate-fade-in-up animate-fade-in-up-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => sendMessage(s)}
              className="text-left glass-card px-4 py-3 text-sm text-[var(--color-fz-text-secondary)] hover:text-[var(--color-fz-text)] hover:border-[#00A082]/30 transition"
            >
              <Sparkles size={12} className="text-[#00A082] inline mr-2" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="mt-4 animate-fade-in-up animate-fade-in-up-4">
        <div className="flex items-end gap-3 bg-[var(--color-fz-surface)] border border-[var(--color-fz-border)] rounded-2xl p-3 focus-within:border-[#00A082]/50 focus-within:shadow-[0_0_0_3px_rgba(0,160,130,0.1)] transition">
          <textarea
            ref={inputRef}
            placeholder={
              isRunning
                ? 'Agent is working...'
                : agentStatus === 'needs_approval'
                ? 'Waiting for your approval above...'
                : 'Describe what you need...'
            }
            className="flex-1 bg-transparent text-sm text-[var(--color-fz-text)] placeholder:text-[var(--color-fz-text-muted)] resize-none outline-none max-h-32"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRunning || agentStatus === 'needs_approval'}
          />
          <button
            className={`p-2.5 rounded-xl transition ${
              input.trim() && !isRunning && agentStatus !== 'needs_approval'
                ? 'bg-[#00A082] text-white hover:bg-[#008A6E]'
                : 'bg-[var(--color-fz-surface-2)] text-[var(--color-fz-text-muted)]'
            }`}
            onClick={() => sendMessage()}
            disabled={!input.trim() || isRunning || agentStatus === 'needs_approval'}
          >
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <p className="text-xs text-center text-[var(--color-fz-text-muted)] mt-2">
          Agent will preview all shipment creations and email sends before executing.
        </p>
      </div>
    </div>
  );
}
