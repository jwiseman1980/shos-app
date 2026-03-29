# Executive Director — Knowledge File
> Read this at the start of every ED session. Update it at close.
> **Owns:** Strategic direction, board governance, major partnerships, legal/compliance, organizational direction.

**Role:** Executive Director
**Knowledge file:** ED_CONTEXT.md
**App section:** / (Command Dashboard)
**Last updated:** 2026-03-28

---

## Role Definition

The Executive Director is Joseph Wiseman, founder of Steel Hearts. The ED owns:
- Board governance and compliance
- Major partnerships and external relationships
- Fundraising strategy and major donor cultivation
- Legal/regulatory matters (state registrations, insurance, trademark)
- Compensation and organizational structure
- Strategic direction and priority-setting
- Final approval on anything leaving the organization

**Write permissions:** ED_CONTEXT.md, SHOS_STATE.md, any governance document
**Delegates to, does not do directly:** Daily operations (COO), financial execution (CFO), social media (Comms), donor campaigns (Dev), family outreach (Family), process improvement (COS)

---

## Current State

**As of 2026-03-28:**
- Board: 4 members (Joseph Wiseman, Chris Marti, Alex Kim, Kristin Hughes/Saradarian)
- 12 governance documents drafted, 3 board emails unsent — April 2 adoption deadline
- Supabase project created as primary database (SF becomes nightly backup)
- Architecture decision: App / Vault / Stack three-layer model
- Notion decommission planned
- SC Charitable Solicitation renewal due May 15 ($2K fine risk)
- Zero insurance (no D&O, no GL)

**Key metrics:**
- Total charity obligations: $119,490
- Outstanding balance: $40,747
- Active heroes on website: 450+
- Partner orgs tracked: 171-180

---

## Active Todos

**🔴 CRITICAL (This Week)**
- [ ] Send 3 board governance emails (drafted Mar 26, April 2 deadline)
- [ ] Prep April 2 board meeting agenda (12 policies, compensation vote, COI disclosures)
- [ ] March monthly close (Mar 30, SOP-FIN-002)

**🟡 URGENT (April)**
- [ ] SC Charitable Solicitation renewal — expires May 15, prep starts Apr 6
- [ ] VA Foreign Corp Registration research (Apr 6)
- [ ] D&O + General Liability Insurance research (Apr 13)
- [ ] Bracelet cost methodology with CPA (Apr 20)
- [ ] Q2 Quarterly Board Meeting (Apr 26)

**🟢 STRATEGIC**
- [ ] Supabase migration — data transfer from Salesforce
- [ ] Notion decommission — export databases to Supabase
- [ ] Trademark research — USPTO search for Steel Hearts (Apr 13)
- [ ] Financial audit roadmap — reconcile 2015-2025 history (Apr 27)
- [ ] HonorBase architecture session (Apr 3)
- [ ] Partner outreach Phase 1 — no calendar blocks yet, need to schedule

---

## Board of Directors

| Name | Role | Email | Status |
|------|------|-------|--------|
| Joseph Wiseman | Founder / ED | joseph.wiseman@steel-hearts.org | Active |
| Chris Marti | Marketing & Communications | chris.marti@steel-hearts.org | Active |
| Alex Kim | USAFA, Outreach & Development | alex.kim@steel-hearts.org | Active |
| Kristin Hughes/Saradarian | Board Member | kristin@steel-hearts.org | Active |

---

## Key Relationships

| Organization | Contact | Status |
|-------------|---------|--------|
| Drew Ross Memorial Foundation | Sarah Geisen, Stephen Ross | HonorBase pilot — in development |
| USMA Class of 2016 | Alex Kim + Joshua Murphy | Memorial bracelet partnership — active |
| Memorial Valor Foundation | Erica Klenk | ~300-350 bracelet order — pending |
| Hutter CPA, LLC | Tracy Hutter | CPA — 2025 990-EZ in progress |
| Bookkeeper | Sara Curran | QuickBooks, monthly financial prep |

---

## Compliance Status

| Item | Status | Deadline |
|------|--------|----------|
| 501(c)(3) Determination | ✅ Complete | — |
| SC Business Entity | ✅ Filed | — |
| SC Charitable Solicitation | 🔴 RENEWAL DUE | May 15, 2026 |
| VA Foreign Corp Registration | ⚪ Unknown | Research Apr 6 |
| Form 990-EZ (2025) | 🟡 In Progress | TBD |
| Board Governance Policies | 🟡 Drafted, not adopted | April 2, 2026 |
| D&O Insurance | 🔴 NONE | Research Apr 13 |
| General Liability Insurance | 🔴 NONE | Research Apr 13 |
| Trademark | ⚪ None | Research Apr 13 |

---

## Information Architecture

| Layer | System | Purpose |
|-------|--------|---------|
| Primary Database | Supabase | All operational data, real-time |
| Backup Mirror | Salesforce | Nightly sync, compliance copy |
| Interface | SHOS App (Vercel) | What humans use |
| Doctrine | Filesystem (SHOS/) | SOPs, governance, architecture |
| Communication | Gmail, Calendar, Slack, Drive, Meta API | The stack |

---

## Decision Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Supabase as primary database | SF guardrails slow AI development. PostgreSQL = 3x faster. App is the human interface. |
| 2026-03-28 | Salesforce becomes backup mirror | Nightly sync. Free nonprofit tier. Functional disaster recovery. |
| 2026-03-28 | Separate Supabase project for SH | Not shared with GYST. Different governance needs. |
| 2026-03-28 | Notion decommission planned | All operational data to Supabase. Doctrine stays on filesystem. |
| 2026-03-28 | Three-layer information architecture | App (Supabase + SHOS App), Vault (filesystem), Stack (Gmail/Calendar/Slack/Drive/Meta). |

---

## Session Log

| Date | Summary | Next |
|------|---------|------|
| 2026-03-28 | ED initialization. Full information audit across all systems. Architecture decisions: Supabase primary, SF backup, Notion decommission. Schema designed (22 tables), Supabase project created, all tables deployed. Migration prompt written. ED agent build started. | Complete agent build. Send board emails. March close. |
