# Freshzilla Supply Chain Automation - Complete Architecture

## Overview

A production-ready Next.js + React app that automates supply chain workflows for Freshzilla using Google Workspace CLI, Claude AI, and Supabase.

**Key Features:**
- Contact directory synced from Google Sheets in real-time
- One-click email generation to carriers, brokers, warehouses
- Claude AI drafts professional emails from plain English
- Server-side PDF generation for customs invoices & load forms
- Gmail integration for approval workflows
- Google Drive for document storage
- Audit logs for compliance
- Mobile-responsive dashboard
- Zero configuration needed on client side

**Time to market:** 3-4 weeks for MVP, 8-12 weeks for full Phase 4

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + Next.js 14 (App Router) | Server components, edge functions, built-in API routes |
| **Styling** | Tailwind CSS + shadcn/ui | Fast, accessible, enterprise components |
| **Database** | Supabase (PostgreSQL) | Auth, RLS, real-time subscriptions, free tier |
| **File Storage** | Google Drive + Supabase Storage | Organized docs, auto-versioning |
| **AI** | Claude Sonnet 4.6 (Anthropic API) | Email/invoice generation, conversational interface |
| **Email** | Google Workspace (Gmail API) | Native drafts, templates, tracking |
| **Sheets** | Google Workspace Sheets API | Contact directory, shipment log |
| **Automation** | Google Workspace CLI + Node.js | Command-line interface, no SDK complexity |
| **Hosting** | Vercel | Serverless, auto-scaling, free tier |
| **Background Jobs** | Vercel Cron (or Bull Queue) | Scheduled syncs, daily reports |

---

## Core Architecture

```
┌─────────────────────────────────────────────────────┐
│         GOOGLE WORKSPACE (Source of Truth)          │
├──────────────────────────┬──────────────────────────┤
│   Sheets                 │   Gmail                  │
│ - Contacts               │ - Email drafts           │
│ - Shipment log           │ - Approvals              │
│ - Carrier rates          │ - Templates              │
│ - Approval queue         │ - Sent history           │
└──────────────────────────┴──────────────────────────┘
           ↑                        ↓
    (gcloud CLI commands)    (Gmail API)
           ↑                        ↓
┌─────────────────────────────────────────────────────┐
│      FRESHZILLA NEXT.JS SERVER (Brain)              │
├──────────────────────────┬──────────────────────────┤
│  lib/                    │  api/                    │
│ - google-workspace.ts    │ - contacts/sync          │
│ - anthropic.ts           │ - shipments/create       │
│ - supabase.ts            │ - emails/draft           │
│ - pdf.ts                 │ - emails/send            │
│ - sheets.ts              │ - ai/chat                │
│ - gmail.ts               │ - webhooks/sheets        │
│                          │ - webhooks/gmail         │
├──────────────────────────┼──────────────────────────┤
│ jobs/                    │ middleware/              │
│ - sync-contacts.ts       │ - auth.ts                │
│ - daily-report.ts        │ - logging.ts             │
│ - archive-shipments.ts   │                          │
└──────────────────────────┴──────────────────────────┘
           ↑                        ↓
       (read/write)           (read/write)
           ↑                        ↓
┌─────────────────────────────────────────────────────┐
│       SUPABASE (App Database + Auth)                │
├──────────────────────────┬──────────────────────────┤
│ Tables                   │ Auth                     │
│ - users                  │ - Email/password         │
│ - contacts (synced)      │ - OAuth (Google)         │
│ - shipments              │ - Session management     │
│ - email_drafts           │ - RLS policies           │
│ - conversations          │                          │
│ - messages               │                          │
│ - automation_logs        │                          │
│ - approvals              │                          │
└──────────────────────────┴──────────────────────────┘
           ↑
    (real-time subscriptions)
           ↑
┌─────────────────────────────────────────────────────┐
│      REACT DASHBOARD (Client)                       │
├──────────────────────────┬──────────────────────────┤
│ Pages                    │ Components               │
│ - /dashboard             │ - ShipmentForm           │
│ - /shipments             │ - EmailDraftPanel        │
│ - /contacts              │ - AIChatBox              │
│ - /emails                │ - ApprovalQueue          │
│ - /ai-assistant          │ - ContactDirectory       │
│ - /settings              │ - ShipmentTimeline       │
│ - /reports               │ - PDFPreview             │
│ - /audit-logs            │ - NotificationBell       │
└──────────────────────────┴──────────────────────────┘
```

---

## Phase-by-Phase Breakdown

### Phase 2: Quick Wins (Weeks 1-2)

**Goal:** Hosted app + live contact sync

1. **Deploy Next.js app to Vercel**
   - Auto-deploys on git push
   - Free tier includes 100 GB bandwidth/month
   - API routes run serverless

2. **Google Sheets sync**
   - Cron job runs daily: `gcloud sheets export`
   - Syncs to Supabase `contacts` table
   - UI shows "Last synced 2 hours ago"
   - Manual "Sync now" button for admin

3. **Shipment form → Email draft**
   - Form captures: origin, destination, carrier, weight, description, value, HS code
   - Claude generates professional email body
   - User reviews, edits, copies to clipboard
   - Or: one-click send via Gmail API

4. **PDF generation**
   - Server-side: Customs invoice PDF on demand
   - Customs invoice form pre-filled from shipment data
   - Download button or email as attachment

5. **Contact directory UI**
   - Read-only view of synced contacts
   - Filter by type (warehouse, carrier, broker)
   - Search by name/country/email
   - Manual "Add contact" form (syncs to Sheets on save)

**Effort:** 1 developer, 2 weeks

---

### Phase 3: Email Automation (Weeks 3-5)

**Goal:** Smart email routing + approval workflows

1. **Gmail draft creation**
   - Instead of mailto: links, create actual Gmail drafts
   - Drafts appear in user's inbox, pre-filled
   - User reviews, adds personal notes, sends from Gmail
   - App logs the send action

2. **Email templates in Google Sheets**
   - Sheets tab: "Email Templates"
   - Columns: Template Name, Type (booking/customs/load), Subject, Body
   - Claude customizes templates with shipment data
   - Template fallback if Claude fails

3. **Smart carrier selection**
   - When user selects destination, app recommends carrier
   - Logic: `if destination.country == 'NL' → Frigomundo`
   - Pre-fills carrier email, CC fields
   - User can override

4. **Approval workflow (optional for Phase 3)**
   - Customs invoices require admin approval before send
   - Approval queue in UI
   - Email notifies approver: "New customs invoice awaiting approval"
   - Approver reviews in UI, one-click approve/reject

5. **Google Drive integration**
   - Each shipment creates a folder: `/Freshzilla/Shipments/{Reference}`
   - Auto-upload: invoice PDF, customs form, email drafts
   - Folder shared with relevant carrier/broker
   - File versioning automatic

6. **Email tracking**
   - Log all sent emails to Supabase `email_drafts` table
   - Search/filter: "Show me all emails to DPD in March"
   - Compliance: "Prove we sent customs docs to broker X"

**Effort:** 1 developer, 3 weeks

---

### Phase 4: Full Automation (Weeks 6-12)

**Goal:** AI-powered conversational interface + integrations

1. **Claude AI chat interface**
   - User describes shipment in plain English
   - "Book DPD shipment from Barcelona to Stockholm, 50kg, €2000 value"
   - Claude generates:
     - Email to DPD (booking)
     - Customs declaration (if EU→non-EU)
     - Load form (if warehouse pickup)
     - Google Sheet entry (auto-logged)
   - User reviews all 3 documents, sends with one click

2. **Multi-turn conversations**
   - "Add 10kg more, change destination to Oslo"
   - Claude re-generates affected docs only
   - Chat history stored in Supabase
   - Can resume interrupted conversations

3. **Carrier API integrations (optional)**
   - DPD API: auto-book shipment, get tracking number
   - Shipsy: push shipment data, get label
   - Flexport: lookup rates, auto-quote
   - Fallback: always generates email as backup

4. **ERP integration via webhooks**
   - Your ERP (SAP, NetSuite, etc.) calls Freshzilla webhook
   - Webhook payload: `{ orderID, origin, destination, items[], weight, value }`
   - Freshzilla creates shipment, generates emails, logs to Sheets
   - Returns: `{ shipmentID, trackingURL, estimatedDelivery }`

5. **Scheduled jobs**
   - **Daily at 8am:** Send "Pending approvals" email to admin
   - **Daily at 6pm:** Sync Google Sheets → Supabase
   - **Weekly:** Generate shipment report (volume, cost, time-saved)
   - **Monthly:** Archive old shipments, create reports for CFO

6. **Dashboard analytics**
   - Total shipments this month
   - % automated vs manual
   - Time saved per shipment (avg 1.5 hours → 10 min)
   - Cost per shipment by carrier
   - Carrier performance (on-time %, error rate)
   - Regional breakdown

7. **User roles & permissions**
   - **Admin:** Can approve emails, manage contacts, view all logs
   - **Warehouse:** Can create shipments, view own drafts
   - **Finance:** Can view reports, cost analysis
   - **Viewer:** Read-only access to shipment history

8. **Audit & compliance**
   - Every action logged: who, what, when
   - Searchable: "Show all emails sent to broker X in Q1"
   - Export to PDF for audits
   - Immutable log (can't edit, only append)

**Effort:** 1-2 developers, 6-8 weeks

---

## Database Schema

### users
```
id (UUID) - from Supabase Auth
email (TEXT)
name (TEXT)
role (ENUM: admin, user, warehouse, finance, viewer)
company (TEXT)
created_at (TIMESTAMP)
```

### contacts
```
id (UUID)
name (TEXT) - synced from Google Sheets
type (ENUM: warehouse, carrier, broker, customer)
email (TEXT)
phone (TEXT)
address (TEXT)
city (TEXT)
country (TEXT)
is_active (BOOLEAN)
google_sheets_row_id (TEXT) - for two-way sync
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

### shipments
```
id (UUID)
reference (TEXT) - unique identifier
status (ENUM: draft, pending_approval, sent, confirmed, delivered)
origin_contact_id (UUID FK)
destination_contact_id (UUID FK)
carrier_id (UUID FK)
description (TEXT)
weight_kg (DECIMAL)
volume_cbm (DECIMAL)
value_usd (DECIMAL)
currency (TEXT)
hs_code (TEXT)
incoterm (TEXT: FCA, CIF, etc)
special_handling (TEXT: fragile, hazmat, etc)
created_by (UUID FK users)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
google_sheets_row_id (TEXT)
drive_folder_id (TEXT) - link to Google Drive folder
```

### email_drafts
```
id (UUID)
shipment_id (UUID FK)
draft_type (ENUM: booking, customs, load_request, notification)
recipient_email (TEXT)
cc_emails (TEXT[])
subject (TEXT)
body (TEXT)
status (ENUM: draft, pending_approval, approved, sent, rejected)
generated_by (ENUM: claude, template, manual)
approved_by (UUID FK users)
sent_at (TIMESTAMP)
gmail_message_id (TEXT) - Gmail API message ID
created_at (TIMESTAMP)
```

### conversations
```
id (UUID)
user_id (UUID FK)
shipment_id (UUID FK) - optional, linked conversation
title (TEXT)
created_at (TIMESTAMP)
```

### messages
```
id (UUID)
conversation_id (UUID FK)
role (ENUM: user, assistant)
content (TEXT)
created_at (TIMESTAMP)
```

### automation_logs
```
id (UUID)
event_type (TEXT: email_sent, pdf_generated, sheet_synced, approval_requested, etc)
shipment_id (UUID FK) - optional
user_id (UUID FK) - optional
details (JSONB) - flexible data
status (ENUM: success, error, pending)
error_message (TEXT)
created_at (TIMESTAMP)
```

### approvals
```
id (UUID)
email_draft_id (UUID FK)
requested_by (UUID FK users)
assigned_to (UUID FK users)
status (ENUM: pending, approved, rejected)
comment (TEXT)
created_at (TIMESTAMP)
decided_at (TIMESTAMP)
```

---

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Email/password login
- `GET /api/auth/user` - Current user
- `POST /api/auth/logout` - Sign out

### Contacts
- `GET /api/contacts` - List all active contacts
- `POST /api/contacts` - Create new contact
- `PUT /api/contacts/:id` - Update contact
- `DELETE /api/contacts/:id` - Soft delete
- `POST /api/contacts/sync-sheets` - Manual sync from Google Sheets
- `POST /api/contacts/bulk-import` - Import CSV

### Shipments
- `GET /api/shipments` - List shipments (paginated)
- `GET /api/shipments/:id` - Get shipment detail
- `POST /api/shipments` - Create shipment
- `PUT /api/shipments/:id` - Update shipment
- `DELETE /api/shipments/:id` - Archive shipment
- `GET /api/shipments/:id/pdf` - Download customs invoice PDF

### Email Drafts
- `GET /api/emails` - List email drafts
- `POST /api/emails/draft` - Generate email draft via Claude
- `GET /api/emails/:id` - Get draft detail
- `PUT /api/emails/:id` - Update draft
- `POST /api/emails/:id/send` - Send via Gmail API
- `POST /api/emails/:id/approve` - Approve draft (for workflow)
- `POST /api/emails/:id/reject` - Reject draft

### AI Chat
- `POST /api/ai/chat` - Send message, get Claude response
- `GET /api/ai/conversations` - List conversations
- `GET /api/ai/conversations/:id` - Get conversation + messages
- `DELETE /api/ai/conversations/:id` - Archive conversation

### Reports
- `GET /api/reports/dashboard` - Summary stats
- `GET /api/reports/shipments` - Shipment metrics
- `GET /api/reports/carriers` - Carrier performance
- `GET /api/reports/costs` - Cost analysis

### Webhooks
- `POST /api/webhooks/sheets` - Triggered by Google Sheets change
- `POST /api/webhooks/gmail` - Triggered by Gmail label/flag
- `POST /api/webhooks/erp` - Inbound from your ERP system

### Admin
- `GET /api/admin/logs` - Audit log
- `GET /api/admin/users` - User management
- `POST /api/admin/sync-all` - Force full resync

---

## Page Structure

### Public Pages
- `/` - Marketing/login page
- `/signup` - Create account

### Authenticated Pages

**Dashboard**
- `/dashboard` - Overview, recent shipments, pending approvals, quick stats

**Shipments**
- `/dashboard/shipments` - List view with filters, search, export
- `/dashboard/shipments/new` - Create new shipment form
- `/dashboard/shipments/:id` - Detail view with email drafts, timeline, PDFs
- `/dashboard/shipments/:id/edit` - Edit form

**Contacts**
- `/dashboard/contacts` - Directory, sync status, edit inline
- `/dashboard/contacts/new` - Add contact form

**Email Management**
- `/dashboard/emails` - All drafts, sent history, approval queue
- `/dashboard/emails/:id` - Draft detail, preview, send/approve buttons

**AI Assistant**
- `/dashboard/ai-assistant` - Chat interface for shipment generation
- `/dashboard/ai-assistant/:id` - Conversation detail + regenerate

**Settings**
- `/dashboard/settings/profile` - User profile, change password
- `/dashboard/settings/contacts` - Manage warehouses/carriers
- `/dashboard/settings/templates` - Manage email templates
- `/dashboard/settings/integrations` - Connect ERP, API keys

**Admin Only**
- `/dashboard/admin/users` - User management, roles
- `/dashboard/admin/logs` - Audit trail, export
- `/dashboard/admin/reports` - Analytics, KPIs, exports
- `/dashboard/admin/sync` - Manual sync controls

---

## Deployment Checklist

### Pre-Deployment
- [ ] Google Cloud project created
- [ ] Service account + key downloaded
- [ ] Google Sheets ID configured
- [ ] Google Drive folder structure created
- [ ] Supabase project created
- [ ] Supabase schema imported (SQL)
- [ ] Claude API key obtained
- [ ] GitHub repo initialized
- [ ] Environment variables documented

### Vercel Deployment
- [ ] GitHub repo connected to Vercel
- [ ] Environment variables added to Vercel dashboard
- [ ] Database migrations run (`npm run db:migrate`)
- [ ] Test deployment on staging URL
- [ ] Custom domain configured (optional)
- [ ] SSL certificate auto-provisioned
- [ ] Cron jobs configured in `vercel.json`

### Post-Deployment
- [ ] Test auth flow (signup → email confirmation)
- [ ] Test contact sync from Google Sheets
- [ ] Test email draft generation
- [ ] Test PDF download
- [ ] Test Claude AI chat
- [ ] Test Gmail integration
- [ ] Create admin user
- [ ] Invite team members
- [ ] Run first shipment through workflow
- [ ] Document any custom setup steps

---

## Implementation Timeline

### Week 1-2: MVP Foundation
- Vercel setup + Supabase auth
- Contact directory sync from Sheets
- Shipment form + Claude email generation
- Basic dashboard

### Week 3-4: Email Automation
- Gmail integration for drafts
- PDF customs invoices
- Approval workflow
- Google Drive integration

### Week 5-6: Polish & Testing
- Mobile responsiveness
- Email templates
- Audit logs
- Bug fixes, performance optimization

### Week 7-12: Phase 4 (Optional)
- AI chat interface (multi-turn)
- Carrier API integrations
- ERP webhooks
- Analytics dashboard
- Scheduled jobs

---

## Cost Breakdown (Monthly)

| Service | Cost | Notes |
|---------|------|-------|
| Vercel | $0-20 | Free tier covers MVP, $20/mo for Pro |
| Supabase | $0-100 | Free tier: 500MB DB, then $25/100GB |
| Claude API | $0-200 | ~$0.01/email draft, ~$0.05/chat |
| Google Workspace | $6-14/user | Already have it likely, includes Sheets/Gmail/Drive |
| SendGrid (optional) | $0-30 | For email sending (free tier: 100 emails/day) |
| **Total** | **$6-364** | Most will be $6-40 until high volume |

---

## Security & Compliance

- **Auth:** Supabase handles password hashing, session management, 2FA
- **RLS:** Row-level security policies ensure users only see own data
- **Audit:** Every action logged with user, timestamp, details
- **Encryption:** Google Workspace handles encryption at rest
- **GDPR:** Can export/delete user data via API
- **SOC2:** Supabase is SOC2 Type II compliant
- **Data residency:** Choose EU or US region in Supabase

---

## Monitoring & Maintenance

### Monitoring
- Vercel Analytics: uptime, response times
- Supabase Logs: slow queries, errors
- Email tracking: delivery rates, bounces
- Google Workspace: API quotas, errors

### Maintenance
- Weekly: Review error logs, performance metrics
- Monthly: Archive old shipments, backup database
- Quarterly: Update dependencies, security patches
- Annually: Capacity planning, cost optimization

---

## Key Success Metrics

1. **Adoption:** % of team using app weekly
2. **Automation:** % of shipments created via app vs manual
3. **Time savings:** avg time per shipment (goal: 45min → 5min)
4. **Accuracy:** reduction in mis-sent emails, wrong addresses
5. **Compliance:** 100% email audit trail, 0 missing docs
6. **Cost:** cost per shipment, carrier negotiation data
7. **Uptime:** target 99.9% availability

---

## Next Steps

1. **This week:** Set up Google Cloud project, create Supabase instance
2. **Next week:** Deploy boilerplate Next.js app to Vercel
3. **Week 3:** Implement contact sync + shipment form
4. **Week 4:** Add Claude AI + PDF generation
5. **Week 5:** Test with real shipment workflow
6. **Week 6:** Train team, go live
7. **Weeks 7+:** Iterate based on feedback, add Phase 4 features