# ED Knowledge File
**Role:** Executive Director
**Last Updated:** 2026-03-28
**Session Count:** 1

---

## Role Definition
The ED is Joseph. This role is the strategic owner of Steel Hearts — board governance, major partnerships, fundraising strategy, media relationships, legal/compliance, and organizational direction. The ED doesn't run the daily operations — that's what the COO, COS, CFO, and Comms roles are for. The ED makes the big calls and represents Steel Hearts to the outside world.

---

## Current State (as of 2026-03-28)

| Metric | Value |
|--------|-------|
| Board Members | 4 (Joseph Wiseman, Chris Marti, Alex Kim, Kristin Hughes/Saradarian) |
| Major Partnerships Active | 2 (DRMF — HonorBase pilot, USMA Class of 2016 — memorial bracelet) |
| Annual Revenue (2025) | Pending — 990-EZ in preparation with CPA Tracy Hutter |
| Annual Revenue (2026 YTD) | Tracking in SF; Jan validated (183 bracelets), Feb validated (147 bracelets, $1,470 obligations), Mar in progress |
| Compliance Status | Partially compliant — governance package drafted, 3 board emails unsent |
| State Registrations Current | SC business entity filed (Feb 2025). SC Charitable Solicitation renewal due May 15, 2026 (P88840). No other states confirmed. |
| Insurance | NONE — no D&O, no General Liability |
| Total Charity Obligations (cumulative) | $119,490 owed to external orgs |
| Outstanding Balance | $40,747 remaining liability |
| Active Heroes (website) | 450+ with Active_Listing__c = true |
| Partner Orgs Tracked | 171–180 (SF Accounts) |

---

## Organizational Overview

### Legal Structure
- **Entity:** Steel Hearts Incorporated
- **Type:** 501(c)(3) nonprofit
- **EIN:** [In IRS Letter of Determination — file on disk at Finance/Donation Roll-Ups/01 - Administration/Letter of Determination.pdf]
- **Incorporation State:** South Carolina (Articles of Incorporation on file; SC SOS filings Feb 2025)
- **IRS Determination Letter:** On file (sent to Bracelets for America Nov 2022, copy at Finance/Donation Roll-Ups/01 - Administration/)

### Board of Directors (as of 12/31/2025 per 990-EZ filing)
| Name | Role | Email | Status |
|------|------|-------|--------|
| Joseph Wiseman | Founder / Executive Director | joseph.wiseman@steel-hearts.org | Active |
| Chris Marti | Board Member (Marketing & Communications) | chris.marti@steel-hearts.org | Active |
| Alex Kim | Board Member (USAFA, Outreach & Development) | alex.kim@steel-hearts.org | Active |
| Kristin Hughes/Saradarian | Board Member | kristin@steel-hearts.org | Active |

**Board governance status:** 12 governance documents drafted, 3 email drafts to board sitting unsent (as of Mar 26). April 2 board meeting scheduled for policy adoption + compensation vote ($40K ED salary, retroactive $7.5K for 2025).

### Key Personnel (non-board)
| Name | Role | Notes |
|------|------|-------|
| Sara Curran | Bookkeeper | QuickBooks, financial prep, works with CPA |
| Tracy Hutter | CPA (Hutter CPA, LLC) | 990-EZ preparation, tax compliance |

---

## Information Architecture (Canonical — decided 2026-03-28)

### The Model
| Layer | Name | What It Is |
|-------|------|-----------|
| Primary Database | **Supabase** | All operational data. The app reads/writes here in real-time. |
| Backup Mirror | **Salesforce** | Nightly sync from Supabase. Read-only compliance copy. Functional if everything else goes down. |
| Interface | **SHOS App** | Next.js on Vercel. What Joseph and the team actually use. The human-friendly layer. |
| Doctrine | **The Vault** (filesystem) | SOPs, governance docs, architecture, knowledge files. Things that govern how work happens. |
| Communication | **The Stack** | Gmail, Google Calendar, Slack, Google Drive, Meta Graph API. |

### The Rule
- **If you work with it** → it's in the app (Supabase + SHOS App UI)
- **If it governs how you work** → it's in the vault (filesystem)
- **If you communicate through it** → it's in the stack (Gmail/Calendar/Slack/Drive)

### Design Philosophy
Software guardrails (governor limits, click-through UIs, rigid schemas) exist for humans with limited cognitive bandwidth. AI doesn't need them. The SHOS App is the human interface — everything behind it is optimized for AI speed and correctness. Supabase (raw PostgreSQL) over Salesforce for primary ops.

### Migration Plan
1. Create separate Supabase project for Steel Hearts (not shared with GYST)
2. Build new objects first in Supabase (tasks, volunteers, engagement logs)
3. Migrate existing SF data to Supabase (heroes, donations, orders, disbursements, expenses, messages, contacts, accounts)
4. Update app API routes to read from Supabase instead of SF
5. Build Supabase → Salesforce nightly sync
6. Export all Notion data and load into Supabase
7. Decommission Notion

---

## Information Source Map

| Domain | Canonical Source | Backup / Secondary |
|--------|-----------------|-------------------|
| Heroes / Memorials | Supabase → SHOS App | Salesforce (nightly sync) |
| Family Contacts | Supabase → SHOS App | Salesforce |
| Orders / Production Pipeline | Supabase → SHOS App | Salesforce |
| Donations Received | Supabase → SHOS App | Salesforce, Donorbox, Stripe |
| Charity Obligations | Supabase (calculated) → SHOS App | Salesforce |
| Disbursements to Charities | Supabase → SHOS App | Salesforce, QuickBooks |
| Expenses | Supabase → SHOS App (Chase CSV import) | Salesforce, QuickBooks, Chase bank |
| Family Messages | Supabase → SHOS App | Salesforce |
| Tasks / Team Assignments | Supabase → SHOS App (TO BUILD) | — |
| Volunteer Management | Supabase → SHOS App (TO BUILD) | — |
| Engagement / Decision Logs | Supabase → SHOS App (TO BUILD) | — |
| Anniversary Cycle Execution | Supabase → SHOS App | Salesforce |
| Design Pipeline | Supabase → SHOS App | Salesforce |
| Partnerships / Charities | Supabase (Accounts table) → SHOS App | Salesforce |
| SOPs / Governance / Doctrine | Filesystem (SHOS/) | — |
| Role Knowledge Files | Filesystem + Supabase (SHOS_Knowledge) | Salesforce |
| Calendar / Scheduling | Google Calendar | — |
| Email / Correspondence | Gmail | — |
| Team Chat | Slack | — |
| Financial Docs / Tax Returns | Google Drive + local Finance folder | — |
| Design Files (SVGs) | Google Drive | — |
| Website | SHOS App (Vercel) | — |
| Social Media Data | Meta Graph API | — |
| Personal Finance (GYST) | Supabase (separate project) → GYST Dashboard | — |

---

## SHOS App — Current State (v0.3)

**Deployed:** Vercel
**Framework:** Next.js 13+ (App Router)
**Auth:** Session-based (cookie: shos_session)
**Current DB:** Salesforce (transitioning to Supabase)

### Functional Pages (17)
| Page | Route | Role | Capability |
|------|-------|------|-----------|
| Command Dashboard | `/` | ED | Daily brief, role status cards, anniversaries, donations, orders |
| SOP Runner | `/sops` | COS | SOP listing, run history, execution |
| SOP Detail | `/sops/[id]` | COS | Step-by-step procedure execution |
| Finance Overview | `/finance` | CFO | Org balances, disbursements, obligations, D-variant tracking |
| Bracelet Pipeline | `/bracelets` | COO | Family intake wizard, design stages, inventory, research queue |
| Order Queue | `/orders` | COO | Kanban fulfillment board, production status |
| Design Queue | `/designs` | COO | SVG upload, design workflow, status management |
| Memorial Registry | `/memorials` | Comms | Hero stats by branch, bio page tracking, missing links |
| Anniversary Tracker | `/anniversaries` | Comms | Month view, volunteer assignments, status, completion tracking |
| Donor Engagement | `/donors` | Dev | Segments, retention, impact updates, thank-you drafts |
| Family Messages | `/messages` | Family | Messages grouped by hero, delivery status, dedup, cleanup |
| COS Overview | `/cos` | COS | Role scaffold, task inventory |
| COO Overview | `/coo` | COO | Role scaffold, task inventory |
| Comms Overview | `/comms` | Comms | Role scaffold, task inventory |
| Dev Overview | `/dev` | Dev | Role scaffold, task inventory |
| Family Overview | `/family` | Family | Role scaffold, task inventory |
| Login | `/login` | — | Authentication |

### Stub / Not Yet Built (10)
| Page | Route | Priority | Notes |
|------|-------|----------|-------|
| Task Management | — | HIGH | Needs Supabase table + full CRUD UI. Replaces Notion Steel Hearts Tasks. |
| Volunteer Management | `/volunteers` | HIGH | Needs Supabase table + CRUD. Replaces Notion tracker. |
| Families Database | `/families` | HIGH | Route exists. Needs build-out. |
| Email Composer | `/email` | MEDIUM | Route exists. Integration with Gmail API. |
| Inventory Management | `/inventory` | MEDIUM | Route exists. Standalone inventory view. |
| Laser Production | `/laser` | MEDIUM | Route exists. Production settings + queue. |
| Shipping | `/shipping` | MEDIUM | Route exists. ShipStation integration. |
| Content Generator | `/content` | LOW | Route exists. Social media content tool. |
| Org Chart | `/org` | LOW | Route exists. Team visualization. |
| Settings | `/settings` | LOW | Route exists. App configuration. |

### API Routes (40+)
Full CRUD for: heroes, orders, designs, donations, families, finance (disbursements, expenses, obligations, org-balances, d-variants, report), messages, anniversaries, SOPs, donors, auth.

---

## Active Strategic Priorities (as of 2026-03-28)

### CRITICAL (This Week / Next Week)
1. **Send board governance emails** — 3 drafts sitting unsent since Mar 26. April 2 deadline.
2. **April 2 Board Meeting** — Adopt 12 governance policies, compensation vote, COI disclosures, officer roles.
3. **March Monthly Close** (Mar 30) — SOP-FIN-002 execution.

### URGENT (April)
4. **SC Charitable Solicitation Renewal** — Expires May 15, 2026. Up to $2,000 fine. Prep begins Apr 6.
5. **VA Foreign Corp Registration** — Research whether operating from VA triggers registration (Apr 6).
6. **D&O + General Liability Insurance** — Currently zero coverage. Board members unprotected. Research Apr 13.
7. **Bracelet Cost Methodology** — CPA session Apr 20. Affects 990 reporting and donated bracelet valuation (1,000+ donated in 2026, difference between $3K and $15K in reported program expenses).

### STRATEGIC (April–May)
8. **Supabase Migration** — Create SH project, design schema, build new objects, begin data migration.
9. **Notion Decommission** — Export all databases (tasks, anniversary tracker, design tracker, volunteer tracker, engagement logs), load into Supabase.
10. **Q2 Quarterly Board Meeting** (Apr 26) — Financial review, operational update, strategic initiatives.
11. **Financial Audit Roadmap** (Apr 27) — Reconcile all SH financial history (2015–2025).
12. **Trademark Research** (Apr 13) — USPTO search for Steel Hearts logo + name.

### BUILDING
13. **SHOS App: Task Management** — Replace Notion Steel Hearts Tasks.
14. **SHOS App: Volunteer Management** — Replace Notion Volunteer Onboarding Tracker.
15. **SHOS App: Engagement / Decision Logs** — Replace Notion engagement databases.
16. **HonorBase LLC** — DRMF as first target. Architecture session Apr 3.

### NOT YET SCHEDULED (Gaps Identified)
- Partner outreach calls (Phase 1 April plan exists in memory but no calendar blocks)
- Fundraising strategy / campaigns
- ZEUS 95 / Navas outreach execution
- DRMF-specific meeting beyond architecture session

---

## Key Relationships

| Organization | Contact | Relationship | Status |
|-------------|---------|-------------|--------|
| Drew Ross Memorial Foundation (DRMF) | Sarah Geisen, Stephen Ross | HonorBase pilot target | In development |
| Memorial Valor Foundation | Erica Klenk | ~300-350 bracelet order estimated | Pending |
| USMA Class of 2016 | Alex Kim (board) + Joshua Murphy | Class memorial bracelet partnership | Active — positive response from class leadership Mar 2026 |
| Whiskey Valor Foundation | — | Event partnership philosophy alignment | Exploratory |
| Fallen Wings Foundation | Janie Sullivan | ZEUS 95 bracelet donation (6 crew families + squadrons) | Outreach planned |
| Hutter CPA, LLC | Tracy Hutter | CPA — 990-EZ, tax compliance | Active |
| Bookkeeper | Sara Curran | QuickBooks, monthly financial prep | Active |

---

## HonorBase LLC
- **Purpose:** AI-powered nonprofit ops company — services + merch
- **Structure:** Virginia LLC, Joseph sole owner
- **First Target:** DRMF (Drew Ross Memorial Foundation)
- **Status:** In development. Architecture session scheduled Apr 3.
- **Concept:** Package SHOS capabilities as a service for other Gold Star nonprofits.

---

## Compliance Status

| Item | Status | Deadline | Notes |
|------|--------|----------|-------|
| 501(c)(3) Determination | Complete | — | IRS Letter on file |
| SC Business Entity | Filed | — | Feb 2025 with SC SOS |
| SC Charitable Solicitation | RENEWAL DUE | May 15, 2026 | Charity Public ID P88840. Up to $2K fine. |
| VA Foreign Corp Registration | UNKNOWN | — | Research scheduled Apr 6 |
| Other State Solicitation Registrations | UNKNOWN | — | No evidence of filings beyond SC |
| Form 990-EZ (2025) | In Progress | TBD | CPA Tracy Hutter + Sara Curran preparing |
| Form 990-EZ (2024) | Filed | — | Copy on file in Finance/Tax Returns/ |
| Form 990-EZ (2023 Amended) | Draft | — | Draft on file, unclear if filed |
| Board Governance Policies | DRAFTED, NOT ADOPTED | April 2, 2026 | 12 documents ready. 3 board emails unsent. |
| COI Policy | Drafted | April 2, 2026 | Part of governance package |
| Whistleblower Policy | Drafted | April 2, 2026 | Part of governance package |
| Document Retention Policy | Drafted | April 2, 2026 | Part of governance package |
| D&O Insurance | NONE | — | Research scheduled Apr 13 |
| General Liability Insurance | NONE | — | Research scheduled Apr 13 |
| Trademark | NONE | — | Research scheduled Apr 13 |

---

## Financial Overview

### Revenue Sources
- **Bracelet sales** (Squarespace): $35 standard, $45 D-variant
- **Donations** (Donorbox, Stripe, direct): Variable
- **Wholesale**: Occasional bulk orders at reduced pricing

### Expense Model
- **Charity obligations**: $10/bracelet to designated charity (from $35 and $45 sales)
- **D-variant fund**: Additional $10/bracelet to Steel Hearts internal fund (from $45 sales)
- **Production costs**: Materials (AOC Metals), laser time, shipping
- **Operating expenses**: Software, CPA, bookkeeper, supplies
- **Compensation**: $7,500 in 2025 (retroactive), $40,000 budgeted for 2026 (pending board vote Apr 2)

### Key Financial Files
| File | Location | Contents |
|------|----------|---------|
| 2024 Form 990-EZ | Finance/Tax Returns/ | Filed return (client + public copy) |
| 2023 Draft Amended 990-EZ | Finance/Tax Returns/ | Draft amendment |
| Financial Statements (2022-2024) | Finance/Financial Statements/ | P&L, Balance Sheet, Cash Flows (CSV) |
| Bank Statements (2023) | Finance/Bank Statements/2023/ | Chase Checking (2352) + CC (3418) monthly |
| QuickBooks Export | Finance/QuickBooks Exports/ | Transaction history |
| Donation Receipts (370) | shos-app/data/donation-receipts.json | Gmail receipts 2017-2026 |
| Bracelet Org Mapping | Finance/SF_Bracelet_Organization_Mapping.csv | 460 SKU-to-org records |

---

## Notion Migration Inventory (to be exported before decommission)

### Databases (unique operational data)
| Database | Records | Destination |
|----------|---------|-------------|
| Steel Hearts Tasks | Active team tasks | Supabase → new Tasks page in app |
| Anniversary Remembrance Tracker | Monthly cycle execution | Supabase (merge with existing anniversary fields) |
| Graphic Design Tracker | Design pipeline | Supabase (merge with design status fields) |
| Volunteer Onboarding Tracker | Volunteer intake/status | Supabase → new Volunteers page in app |
| SHOS Engagement Tracker | Engagement records | Supabase → new Engagement page in app |
| SHOS Engagement Decisions | Decision log | Supabase |
| SHOS Engagement Open Questions | Open questions | Supabase |
| SHOS Document Registry | Document tracking | Filesystem (already mirrored) |
| SHOS Closeout Queue | Session closeouts | Supabase |
| SOP Execution Log | SOP run history | Supabase (already partially in SF via SOP runner) |
| Founder Impact Tracker | 12 strategic initiatives | Supabase |

### Pages (content — mostly mirrored on filesystem)
- SOPs (~20 pages) — Already on disk as markdown/docx. Safe.
- Governance docs — Already in SHOS/Governance/. Safe.
- Partnership pages (Whiskey Valor, Event Philosophy, USMA 2016) — Export to filesystem.
- Session notes / architecture proposals — Export to filesystem archive.
- Anniversary email templates (~20 draft pages) — Export to Supabase or filesystem.
- Operator/Architect prompts — Already in skills. Safe.

---

## Decision Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Knowledge file initialized | ED role agent setup — first live session |
| 2026-03-28 | Supabase as primary database | SF guardrails slow AI-driven development. Supabase = raw PostgreSQL, no constraints, 3x faster. App is the human interface. |
| 2026-03-28 | Salesforce becomes backup mirror | Nightly sync from Supabase. Read-only. Functional disaster recovery. Free nonprofit tier. |
| 2026-03-28 | Separate Supabase project for SH | Not shared with GYST. Different governance, different team access needs. GYST may merge into ED role later. |
| 2026-03-28 | Notion decommission planned | All operational data moves to Supabase. Doctrine stays on filesystem. Notion adds no value once migration complete. |
| 2026-03-28 | Information architecture locked | Three layers: App (Supabase + SHOS App), Vault (filesystem), Stack (Gmail/Calendar/Slack/Drive/Meta). |

---

## Session Log

| Date | Summary |
|------|---------|
| 2026-03-28 | ED initialization. Full information audit: Salesforce (12 objects mapped), Gmail (990/board/compliance), Calendar (30-day scan), filesystem (200+ files), Notion (11 databases, 50+ pages), SHOS App (17 functional pages, 10 stubs, 40+ API routes). Architecture decision: Supabase primary, SF backup, Notion decommission. Identified 8 critical gaps. Set strategic priorities. |
