# SHOS State Document
> **The cross-role nervous system.** Every role reads this at session open. Every role writes here at session close.
> A new Executive Director can read this document and be oriented in 30 minutes.

**Last updated:** 2026-03-27
**Updated by:** Joseph Wiseman (ED) + Claude (Architecture Session)

---

## Org Snapshot

**Steel Hearts** is a Gold Star family memorial bracelet nonprofit. We laser-engrave memorial bracelets for fallen service members and donate $10/bracelet to the hero's chosen charity partner. We also send donated bracelets to Gold Star families and charity partner organizations at no cost.

**Executive Director:** Joseph Wiseman (USMA '08)
**Fiscal Year:** Calendar year
**Legal:** Virginia 501(c)(3), founded ~2012
**CPA:** Sara Curran / Tracy

**Operating status:** Active. Revenue from bracelet sales (~$35-$45/bracelet), small individual donor base. Building financial infrastructure and institutional processes through SHOS.

---

## Role Status Blocks

### Executive Director
**Last active:** 2026-03-27
**Current focus:** Architecture session — building SHOS role structure, redesigning app navigation, creating knowledge files for all roles.
**Open flags:** None
**Next session:** March 30 Monthly Close (CFO block, 10am-12pm ET)

---

### Chief of Staff
**Last active:** 2026-03-27 (inaugural session)
**Current focus:** System initialization — knowledge file created, stop hook configured, session closeout model designed.
**Open flags:** None
**Next session:** Schedule after March 30 close. Priority: SOP audit and compliance calendar.
**Knowledge file:** COS_CONTEXT.md

---

### CFO
**Last active:** 2026-03-27
**Current focus:** March 30 close preparation. Finance section fully built (8 pages live). Recon matrix live with 184 partner orgs and 370 Gmail receipts.
**Open flags:**
- 🔴 BLOCKING: Create SF fields before March 30 — Cycle_Month__c, Cycle_Year__c, Receipt_Captured__c on Donation_Disbursement__c
- 🔴 BLOCKING: Create Expense__c custom object in SF before March 30
**Next session:** March 30 Monthly Close (10am-12pm ET)
**Knowledge file:** CFO_CONTEXT.md (rename from FINANCE_TODO.md — pending)

---

### COO
**Last active:** Unknown (role not yet formalized)
**Current focus:** 4 active intake heroes in pipeline. Normal production cadence.
**Open flags:** COO knowledge file needs first session to establish baseline state.
**Next session:** Schedule a COO block — pipeline review and knowledge file initialization.
**Knowledge file:** COO_CONTEXT.md

---

### Communications
**Last active:** Unknown (role not yet formalized)
**Current focus:** Daily social engagement running via Meta API. Weekly amplification SOPs active.
**Open flags:** Comms knowledge file needs first session to establish baseline state.
**Next session:** Schedule a Comms block — content calendar planning and knowledge file initialization.
**Knowledge file:** CMO_CONTEXT.md

---

### Development
**Last active:** Unknown (role not yet formalized)
**Current focus:** Donors page live. No active campaigns or grants in flight.
**Open flags:**
- Development is the highest-value unbuilt role — schedule a Dev block soon.
- Stripe donation page stub ready, activates with new website.
**Next session:** Schedule a Dev block. Priority: donor segment review and fundraising strategy.
**Knowledge file:** DEV_CONTEXT.md

---

### Family Relations
**Last active:** Unknown (role not yet formalized)
**Current focus:** FM-OPS-002 (supporter messages) running. Anniversary outreach cadence active.
**Open flags:** Family Relations knowledge file needs first session to establish baseline state.
**Next session:** Schedule a Family block — anniversary preview and knowledge file initialization.
**Knowledge file:** FAMREL_CONTEXT.md

---

## Cross-Role Flags

| Date | Source | Target | Flag | Status |
|------|--------|--------|------|--------|
| 2026-03-27 | CFO | ED | Create SF fields before March 30 close | 🔴 Open |
| 2026-03-27 | CFO | ED | Create Expense__c object in SF | 🔴 Open |
| 2026-03-27 | CFO | COO | FIN-RECON-002: 184 partner orgs need reconciliation — COO knows the orgs | ⚪ Queued |

---

## Upcoming Calendar

| Date | Role | Session | Duration |
|------|------|---------|----------|
| 2026-03-30 | CFO | Monthly Close | 2 hrs |
| 2026-04-01 | CFO | Historical Reconciliation | 2 hrs |
| 2026-04-03 | ED | Architecture Session (continued) | 2 hrs |
| 2026-04-08 | CFO | Weekly Reconciliation (series, 16 sessions) | 1.5 hrs |

---

## Decision Log

| Date | Role | Decision | Reasoning |
|------|------|----------|-----------|
| 2026-03-27 | ED/CFO | Delete Donorbox integration | Requires $17/month premium API access. Stripe stub ready for when new website is live. |
| 2026-03-27 | ED | Build SHOS role-based architecture | 7 roles (ED, COS, CFO, COO, Comms, Dev, Family). Each role = calendar block = knowledge file = app section. |
| 2026-03-27 | ED | Chief of Staff is a separate role | Even though ED currently does COS work, building it out now creates a clean future handoff. |
| 2026-03-27 | ED | Family Relations owns volunteers | 90% of volunteer activity is family outreach. COO/Comms get their own volunteer resources if needed later. |
| 2026-03-27 | ED | Anniversaries owned by Family Relations | Family Relations owns the data and outreach. Communications subscribes for post scheduling. One source, two consumers. |
| 2026-03-27 | ED | Memorial Pages primary to Communications | COO intake creates the hero record; Communications owns the page once live. |

---

## Handoff Test
*At any time, all of the following must be true:*

- [ ] A new Executive Director can read this document and understand everything in 30 minutes
- [ ] A real CFO can open CFO_CONTEXT.md and the finance section and be operational in a day
- [ ] A board member can find every significant decision and why it was made
- [ ] A volunteer can read an SOP and execute a process without talking to anyone

*If any of these fails — something is undocumented. That's the gap to fill.*

---

*Updated at session close. Do not let this file go stale.*
