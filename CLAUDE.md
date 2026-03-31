# SHOS — Steel Hearts Operating System

## Project Overview

SHOS is the internal operations dashboard for Steel Hearts Foundation, a 501(c)(3) nonprofit (EIN: 47-2511085) that honors fallen military service members through memorial bracelets, family remembrance, and charitable giving. Founded by Joseph Wiseman, USMA Class of 2008.

This is a Next.js 15 App Router application with React 19. It serves as the operational brain — managing bracelet production, family intake, donor stewardship, finance, social media, email, and task prioritization.

- **Live app:** https://shos-app.vercel.app
- **GitHub:** https://github.com/jwiseman1980/shos-app
- **Deployed on:** Vercel (GitHub auto-deploy)
- **Primary database:** Supabase (Salesforce is nightly backup mirror)

## Commands

```bash
npm run dev     # Start dev server on port 3000
npm run build   # Production build
npm run lint    # Run linter
```

## Tech Stack

- Next.js 15 App Router, React 19
- Supabase (primary database + storage)
- Salesforce (backup mirror via nightly sync)
- Google Workspace (Gmail, Calendar, Drive — domain-wide delegation)
- Anthropic Claude API (AI chat, email drafting, message generation)
- Stripe (donation webhooks)
- ShipStation (shipping reconciliation)
- Meta Graph API (Facebook/Instagram metrics)
- Slack (webhook notifications)
- Vercel Blob (file storage)

## Auth

Custom HMAC-SHA256 signed session cookies (`shos_session`, 7-day TTL). No NextAuth.
- Passwords stored as bcrypt hashes in `data/volunteers.json` and Supabase `volunteers` table
- API routes authenticate via `SHOS_API_KEY` header for cron/webhook access
- Middleware in `middleware.js` protects all routes except `/login`, `/api/auth/*`, `/_next/*`

## Directory Structure

```
app/                          — Next.js pages and API routes
  page.js                     — Dashboard (priority queue, scoreboard, calendar)
  layout.js                   — Root layout with sidebar + floating role chat
  login/                      — Login page
  orders/                     — Order board (Kanban)
  designs/                    — Design work queue
  laser/                      — Laser engraving queue
  shipping/                   — Shipping queue
  bracelets/                  — Bracelet pipeline
  inventory/                  — Inventory tracker
  families/                   — Family management
  family/                     — Family intake wizard
  messages/                   — Supporter message tracker
  donors/                     — Donor list + [email] detail
  anniversaries/              — Anniversary tracker
  finance/                    — Finance dashboard + sub-pages
    donations/                — Donations received
    disbursements/            — Disbursements
    expenses/                 — Expenses + Chase CSV upload
    report/                   — Monthly financial report
    recon/                    — Reconciliation matrix
    close/                    — Month close
    archive/                  — Finance archive
  email/                      — Gmail inbox + composer
  comms/                      — Communications hub
    social/                   — Social media dashboard (Meta)
  engagements/                — Engagement log
  tasks/                      — Task board
  sops/                       — SOP list + [id] detail
  volunteers/                 — Volunteer roster
  settings/                   — App settings
  memorials/                  — Memorials management
  content/                    — Content management
  coo/cos/dev/                — Role-specific views
  gyst/                       — Personal productivity
  api/                        — All API routes (see below)

components/                   — React components
lib/                          — Server utilities and API clients
  auth.js                     — Session management
  calendar.js                 — Google Calendar (domain delegation)
  gmail.js                    — Gmail API (domain delegation)
  gdrive.js                   — Google Drive (design SVGs)
  salesforce.js               — Salesforce REST API (OAuth, v62.0)
  supabase.js                 — Supabase client factory
  shipstation.js              — ShipStation API
  meta.js                     — Meta Graph API v21.0
  slack.js                    — Slack webhook poster
  stripe.js                   — Stripe client (not present — uses raw API)
  priority-engine.js          — Priority scoring: (urgency*3)+(impact*2)+(decay*1.5)+(rotation*1)
  execution-logger.js         — Logs work to Supabase + Calendar
  email-signature.js          — Dynamic email signatures
  message-packet.js           — Family message delivery formatting
  donation-sync.js            — Parse donation emails → backfill SF
  social-persist.js           — Upsert Meta data to Supabase
  text-repair.js              — Mojibake repair (FM-STD-004)
  dates.js                    — Date utilities
  data/                       — Data access layer modules
    heroes.js                 — Heroes (Supabase + JSON fallback)
    orders.js                 — Orders (Supabase + ShipStation + Drive)
    designs.js                — Design queue
    families.js               — Family contacts
    messages.js               — Supporter messages
    donations.js              — Donations by month
    disbursements.js          — Disbursements by year
    expenses.js               — Expenses + Chase CSV parser
    obligations.js            — Org financial obligations
    monthly-report.js         — 8-section financial report
    pipeline.js               — Hero lifecycle pipeline
    dashboard.js              — Priority queue aggregation
    tasks.js                  — Task management
    sops.js                   — SOP records
    volunteers.js             — Volunteer records
    learning.js               — Learning engine (task time estimates)
  storage/                    — Storage abstraction (SF ↔ Supabase switch)

data/                         — Static JSON files
  heroes.json                 — Hero records fallback
  volunteers.json             — Volunteer roster + auth
  sops.json                   — SOP definitions
  donation-receipts.json      — Gmail receipt cache for recon

scripts/                      — One-time migration scripts
*_CONTEXT.md                  — Role-specific operational context docs
*-knowledge.md                — Live role knowledge files
```

## Cron Jobs (vercel.json)

| Route | Schedule | Purpose |
|-------|----------|---------|
| `/api/orders/reconcile` | 6:07 AM daily | Reconcile orders vs ShipStation |
| `/api/orders/triage` | 6:22 AM daily | Triage new/blocked orders |
| `/api/sync` | 7:03 AM daily | Master data sync (Supabase → Salesforce) |
| `/api/orders/sync-from-sf` | Every hour :15 | Sync orders from Salesforce |
| `/api/daily-briefing` | 11:00 AM daily | Generate + post daily briefing to Slack |
| `/api/cron/anniversary-outreach` | 11:30 AM daily | Email bracelet customers 14 days before hero anniversary |

## Key Architecture Decisions

- **Supabase is primary, Salesforce is backup.** All reads come from Supabase. Nightly sync pushes to Salesforce as a mirror. `SF_LIVE=true` enables live SF writes alongside Supabase.
- **Google Workspace domain-wide delegation.** Service account `shos-gmail-service@shos-490912.iam.gserviceaccount.com` impersonates `joseph.wiseman@steel-hearts.org` for Gmail, Calendar, and Drive.
- **Priority engine drives the dashboard.** Every page feeds items into a single ranked queue. The homepage is the operating cockpit.
- **Role chat uses Anthropic API.** Each role (COO, CFO, CMO, COS, etc.) has its own context doc that scopes the AI assistant to that domain.
- **Path alias:** `@/` resolves to project root.

## Bracelet Production Pipeline

Status enum (Supabase `order_items.production_status`):
`not_started` → `design_needed` → `ready_to_laser` → `in_production` → `ready_to_ship` → `shipped`

## SKU Format

`BRANCH-LASTNAME-SIZE` (e.g., `USMA95-ADAMOUSKI-7`)
- Sizes: `-6` (6 inch), `-7` (7 inch)
- D variants (donated): `USMA95-ADAMOUSKI-7D` — being phased out
- SVG design files match the SKU name

## Slack Notifications

Status changes trigger Slack messages:
- `design_needed` → Ryan's DM (he creates designs)
- `ready_to_laser` → Joseph's DM (he runs the laser)
- `ready_to_ship` → Kristin's DM (she handles shipping)
- `shipped` → ops hub + shipping email to customer

## Environment Variables

**Auth:** `LOGIN_PASSWORD`, `SESSION_SECRET`, `SHOS_API_KEY`, `CRON_SECRET`, `WEBHOOK_SECRET`
**Supabase:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
**Salesforce:** `SF_LIVE`, `SF_CLIENT_ID`, `SF_REFRESH_TOKEN`, `SF_INSTANCE_URL`
**Google:** `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY`, `GDRIVE_DESIGNS_FOLDER_ID`
**Email (SendGrid):** `SENDGRID_API_KEY` — bulk outreach, newsletters, transactional email. Falls back to Gmail BCC draft if not set.
**Slack:** `SLACK_SOP_WEBHOOK`, `SLACK_DM_JOSEPH`, `SLACK_DM_RYAN`, `SLACK_DM_KRISTIN`
**Meta:** `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `META_USER_TOKEN`, `META_PAGE_ID`, `IG_USER_ID`
**Other:** `ANTHROPIC_API_KEY`, `SHIPSTATION_API_KEY`, `SHIPSTATION_API_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Naming Convention

- Always use **"Steel Hearts Foundation"** in user-facing copy.
- The app itself is called **SHOS** (Steel Hearts Operating System).

## Critical Rules

- **Active listings only:** Only heroes with `active_listing = true` appear on the public website. The SHOS app can see all heroes for operational purposes.
- **Never auto-send emails.** AI drafts emails, humans review and send.
- **Never use browser automation for Instagram.** API only. Browser sent garbled "??" to memorial posts.
- **Website and SHOS app are separate Vercel projects.** They share Supabase but must never be merged.
- **Every action gets recorded.** Execution logger writes to Supabase + Google Calendar.
