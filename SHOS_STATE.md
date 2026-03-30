# SHOS State Document
> **The cross-role nervous system.** The Operator and Architect both read this. Updated at every session close.
> A new team member can read this document and be oriented in 30 minutes.

**Last updated:** 2026-03-30
**Updated by:** Joseph Wiseman + Claude (CTO/Architect Session)

---

## Org Snapshot

**Steel Hearts** is a Gold Star family memorial bracelet nonprofit. We laser-engrave memorial bracelets for fallen service members and donate $10/bracelet to the hero's chosen charity partner. We also send donated bracelets to Gold Star families and charity partner organizations at no cost.

**Executive Director:** Joseph Wiseman (USMA '08)
**Fiscal Year:** Calendar year
**Legal:** Virginia 501(c)(3), founded ~2012
**CPA:** Sara Curran / Tracy Hutter

**Operating status:** Active. Revenue from bracelet sales (~$35-$45/bracelet), small individual donor base. Building financial infrastructure and institutional processes through SHOS.

---

## Operating Model (Updated 2026-03-30)

**Two agents:**
- **Operator** — handles ALL operational domains: orders, anniversaries, finance, social media, donors, families, governance. Executes work and flags build issues.
- **Architect** — handles system design, code changes, API fixes, infrastructure. Reads flags from Operator and friction logs.

**Legacy role names (ed, cos, cfo, coo, comms, dev, family) are now task DOMAINS, not separate agents.** The calendars are still split by functional domain (ops, finance, operations, comms, etc.).

---

## Data Architecture (Updated 2026-03-30)

- **Supabase** — Primary database (replaced Salesforce 2026-03-28)
- **Salesforce** — Nightly backup mirror only. DO NOT write new features to SF.
- **Squarespace** — Current storefront. Orders → Salesforce (via Zapier) → Supabase (nightly sync)
- **Meta Graph API** — Facebook + Instagram data, live in SHOS app. Metrics auto-persist to Supabase.
- **Google Calendar** — Functional calendars per domain. Every session, task, and idea gets a slot.
- **Gmail** — Anniversary email drafts via domain-wide delegation
- **Stripe** — Test mode. Ready for website go-live.
- **ShipStation** — Fulfillment tracking. Daily reconcile cron.
- **Slack** — Webhook to #ops-hub. Richer integration planned.

---

## Architect Backlog (Flagged by Operator 2026-03-30)

| Priority | Issue | Status |
|----------|-------|--------|
| CRITICAL | Gmail/Calendar API auth: `unauthorized_client` — domain-wide delegation not configured in Google Workspace Admin | ✅ Fixed |
| HIGH | Order triage API broken — schema mismatch on `order_items.memorial_bracelet_id` | ✅ Fixed (hero_id) |
| HIGH | Squarespace → Supabase routing — orders only reach Supabase via nightly SF sync, consider dual-write | Open |
| MEDIUM | Screenshot/error capture — Operator can't see user's screen or capture errors | Open |
| MEDIUM | Friction log schema — now fixed (operator/architect added to shos_role enum) | ✅ Done |

### Google Calendar Auth Fix (for Joseph)
1. Go to `admin.google.com` → Security → API controls → Domain-wide Delegation
2. Add service account Client ID (from GCP Console → shos-490912 → shos-gmail-service)
3. Scopes: `https://www.googleapis.com/auth/calendar`, `https://www.googleapis.com/auth/gmail.compose`, `https://www.googleapis.com/auth/gmail.send`, `https://www.googleapis.com/auth/drive.file`
4. Also add GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY to local `.env.local` (pull from Vercel: `npx vercel env pull`)

---

## Operational Status

### Orders & Production
- Squarespace orders come in via Salesforce (Zapier integration)
- Army Rugby design orders (USMA-ARMYRUGBY) — design_needed, 2 paid orders waiting
- Query via `/api/orders/triage` or `supabase_query` on orders/order_items tables

### Anniversaries
- 8 April heroes need family contact research before anniversary outreach
- Gmail draft creation blocked by auth issue above

### Finance
- March 30 close was scheduled — check calendar for status
- Salesforce field creation (Cycle_Month__c, Cycle_Year__c, Receipt_Captured__c) may still be needed

### Governance & Compliance
- SC Charitable Solicitation renewal: May 15, 2026
- Board governance policy adoption: April 2, 2026
- 990-EZ filing in progress with CPA Tracy Hutter
- Insurance gaps: zero D&O, zero General Liability

---

## Upcoming Calendar

| Date | Domain | Session | Duration |
|------|--------|---------|----------|
| 2026-04-01 | Finance | Historical Reconciliation | 2 hrs |
| 2026-04-02 | Governance | Board Policy Adoption | - |
| 2026-04-03 | Architecture | HonorBase Design Session | 2 hrs |

---

## Decision Log (Recent)

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-30 | Switch to Operator + Architect model | 8-agent model was overhead. Single Operator handles all domains. Architect handles builds. Domains remain as calendar/task categories. |
| 2026-03-30 | Supabase is primary DB | Salesforce demoted to nightly backup. All new features target Supabase. |
| 2026-03-30 | Meta Graph API integrated | Live FB + IG data in SHOS app. Metrics persist to social_media_posts table. |
| 2026-03-30 | Calendars stay functional | Even with 2 agents, calendars split by work domain (ops, finance, comms, etc.) for organization. |
| 2026-03-28 | Notion and Zapier deprecated | Direct API integrations in SHOS app replaced both. |

---

## Session Log (2026-03-30 CTO/Architect)

### Accomplished
- Voice interface (STT/TTS) built for Operator chat
- Social media persistence layer (tables + auto-persist on API calls)
- System dossiers created (Supabase, Meta, Salesforce backup)
- 8 stale knowledge files archived
- Slack Canvas created: "Steel Hearts Ecosystem Audit & Strategic Roadmap"
- Operator system prompt rewritten for 2-agent model
- shos_role enum updated: added 'operator' and 'architect'
- Calendar tool descriptions updated (functional calendars)
- Vercel env vars added: CRON_SECRET, META_*, IG_USER_ID
- Security: SESSION_SECRET + CRON_SECRET set properly
- Supabase: social_media_posts + social_media_profile_snapshots tables created

### Still Needed
- ~~Google Workspace domain-wide delegation setup~~ ✅ Done
- ~~Local `.env.local` needs Google service account credentials~~ ✅ Done
- Order triage API schema fix
- Architect knowledge file in Supabase
- Screenshot/error capture capability for Operator

---

*Updated at session close. Do not let this file go stale.*
