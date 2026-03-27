# Steel Hearts Operating System — Vision Document
**Created:** 2026-03-27
**Author:** Joseph Wiseman (ED) + Claude (Chief of Staff)
**Status:** Founding document — architecture session pending

---

## The Core Idea

Steel Hearts runs like a fully-staffed organization. Each function has a role. Each role has an AI agent responsible for it. Joseph operates as Executive Director — setting direction, approving decisions, managing external relationships. He does not run every function manually. He directs staff.

The system is always in a state where a real, competent person could join, read the documents, and be operational within a day. This is the governing design constraint for everything.

---

## The Session Model

The calendar block is the atomic unit of work.

- Each block has a role: CFO, COO, CMO, etc.
- Opening a block loads that role's context — Claude reads the knowledge file and briefs the ED
- The session is a focused, bounded unit of work in that role's domain
- Closing a block triggers a closeout: knowledge file updated, thread archived, cross-role flags surfaced
- The next session in that role opens the updated file and picks up exactly where things left off

**The ED hops between roles based on calendar and priority.** He is never in two roles simultaneously. He is never the CFO and the COO at the same time. The calendar block defines who he is right now.

---

## The Staff

### Executive Director — Joseph Wiseman
**Owns:** Direction, external relationships, board, final approvals
**Supported by:** Chief of Staff (daily ops), all role agents (domain outputs)
**Cadence:** Morning briefing daily, approves outputs, routes cross-role flags

---

### Chief of Staff — AI
**Owns:** Executive operations — everything that makes the ED effective
- Daily morning briefing (live)
- Calendar management and session scheduling
- Email routing and triage (live)
- Board governance, compliance calendar, state registrations
- Decision log — every significant decision recorded with context and date
- Meeting prep (live)
- Master state document (SHOS_STATE.md) — updated each session

**Knowledge file:** `COS_CONTEXT.md`
**Status:** Most complete role — briefings, email routing, calendar all live

---

### CFO — AI
**Owns:** All money in and out
- Bracelet sales → obligation tracking ($10/bracelet rule, D-variant = +$10 SH Fund)
- Disbursement execution, cycle management, receipt capture
- Expense tracking (Chase CSV → Expense__c)
- Incoming donations (Stripe when new website is live)
- Monthly close and reporting to Sara Curran / Tracy (CPA)
- Historical reconciliation (FIN-RECON-002 — 370 receipts, 2017-2026)
- Recon matrix — 184 partner orgs, Gmail receipts × SF records
- Financial compliance support (990 prep, audit trail)

**Knowledge file:** `CFO_CONTEXT.md`
**Cadence:** Monthly close (first Monday), weekly reconciliation (Wednesdays)
**Status:** Most complete technical build — all finance pages live

---

### COO — AI
**Owns:** Bracelet production and fulfillment
- Hero intake pipeline (request → design → listing → active)
- Laser engraving settings by material and variant
- Inventory tracking (on-hand by size, reorder triggers)
- ShipStation fulfillment and tracking
- Google Drive design file management
- Squarespace product listing management
- Donated bracelet program operations
- Quality control standards

**Knowledge file:** `COO_CONTEXT.md`
**Cadence:** Weekly pipeline review, on-demand for intake processing
**Status:** App sections exist, needs role-level organization and knowledge file

---

### Director of Communications — AI
**Owns:** Everything the world sees
- Daily social engagement (Meta API — FB + IG, live)
- Weekly amplification (SOPs 002, 014, 015)
- Monthly content calendar
- Anniversary memorial posts (coordinated with Family Relations)
- New website content (when live)
- Brand standards

**Knowledge file:** `CMO_CONTEXT.md`
**Cadence:** Daily engagement, weekly amplification, monthly calendar
**Status:** Fully built as skills, needs integration into app as role section

---

### Director of Development — AI
**Owns:** Money coming in beyond bracelet sales
- Individual donor cultivation and stewardship
- Stripe donation page (stub exists, activates with new website)
- Grant research and applications
- Corporate and foundation partnerships
- Impact reporting to donors
- Campaign planning

**Knowledge file:** `DEV_CONTEXT.md`
**Cadence:** Monthly donor review, quarterly grant calendar
**Status:** Almost entirely unbuilt — highest-value role to develop next after COO

---

### Director of Family Relations — AI
**Owns:** Every Gold Star family interaction
- Family contact database (SF Contacts linked to heroes)
- Anniversary outreach — emails, recognition, remembrance
- Supporter message packaging and delivery (FM-OPS-002, live)
- Volunteer coordination for family outreach
- Hero intake from family-originated requests
- Re-engagement program for families gone quiet
- New family onboarding when a hero is added

**Knowledge file:** `FAMREL_CONTEXT.md`
**Cadence:** Weekly outreach queue, monthly anniversary preview
**Status:** Partially built in skills, family data in SF, needs role home in app

---

## The Knowledge Architecture

```
SHOS_STATE.md              ← Master: org snapshot, all roles, big picture
  ├── COS_CONTEXT.md       ← Chief of Staff: governance, decisions, calendar
  ├── CFO_CONTEXT.md       ← Finance: obligations, reconciliation, monthly close
  ├── COO_CONTEXT.md       ← Operations: pipeline, production, inventory
  ├── CMO_CONTEXT.md       ← Communications: social, content, brand
  ├── DEV_CONTEXT.md       ← Development: donors, grants, fundraising
  └── FAMREL_CONTEXT.md    ← Family Relations: outreach, anniversaries, volunteers
```

**Every knowledge file has the same structure:**
- Role definition — what this role owns
- Current state — what's in flight right now
- Active todos — backlog by priority
- Decision log — recent decisions with reasoning
- SOPs referenced — links to relevant procedures
- Session log — date, what happened, what's next

**SHOS_STATE.md** is the cross-role nervous system:
- Every role reads it at session open
- Every role writes its status block at session close
- Cross-role flags surface here — CFO flags a COO issue, doesn't fix it
- The ED's morning briefing is built from this document
- A new employee reads this and is oriented in 30 minutes

---

## The App Structure

Top-level navigation organized by role:

```
ED Dashboard     → SHOS_STATE.md visual + morning briefing + open flags
CFO              → Monthly Close / Disbursements / Recon Matrix / Expenses / Report
COO              → Pipeline / Intake / Production / Inventory
Communications   → Social Dashboard / Content Calendar / Analytics
Development      → Donors / Campaigns / Grants
Chief of Staff   → Briefing / Calendar / Governance / Compliance
Family           → Outreach / Anniversaries / Messages / Volunteers
```

Every role section has a **"Talk to [Role]"** button. Opens a full agent session pre-loaded with the role's context file and current page data. Ask questions, request fixes, take action — full capability.

---

## The Drift Prevention Model

**Scope drift** (CFO starts doing COO work):
- Prevented by the app — you're on a different page in a different role
- Prevented by the system prompt — each agent has explicit write permissions
- CFO flags COO issues to SHOS_STATE.md, does not fix them

**Knowledge drift** (CFO doesn't know what COO is doing):
- Prevented by SHOS_STATE.md — every role writes its status here
- CFO reads COO's status block without touching COO's domain
- Morning briefing gives the ED the full cross-role picture daily

---

## The Closeout Protocol

**Every session closes out before the thread archives.**

Session close sequence:
1. Stop hook fires automatically when session ends
2. Claude generates structured closeout: done / next / decisions / cross-role flags
3. ROLE_CONTEXT.md updated
4. SHOS_STATE.md updated if significant
5. Thread archived (transcript saved to .jsonl)
6. Calendar event marked complete

This is not optional. A session that ends without a closeout did not happen from the system's perspective.

---

## The Handoff Test

At any point, all of the following must be true:

- A new Executive Director could read `SHOS_STATE.md` and understand everything in 30 minutes
- A real CFO could open `CFO_CONTEXT.md` and the finance section of the app and be operational in a day
- A board member could find every significant decision and why it was made
- A volunteer could read an SOP and execute a process without talking to anyone

If any of these fails — something is undocumented. That's the gap to fill.

---

## This Is HonorBase

Steel Hearts is the first complete instance of a product.

Every function being built here — the role structure, knowledge files, session model, app architecture, agent system — is configurable for any nonprofit. DRMF gets the same system, configured for their org, in a week.

The market: ~1.5 million nonprofits in the US. Most have 1-5 employees. Most are run by a founder-ED wearing every hat. None of them have institutional memory that survives a leadership transition. All of them need what this system provides.

**The pitch:** Your AI staff. All the institutional functions of a fully-staffed nonprofit, for less than one part-time hire.

Steel Hearts proves it works. HonorBase sells it.

---

## Next Steps

- [ ] Architecture session (2 hours) — design full role structure, knowledge file hierarchy, app navigation, agent system
- [ ] Configure session closeout hook (stop hook via update-config)
- [ ] Rename FINANCE_TODO.md → CFO_CONTEXT.md (expand to full format)
- [ ] Create SHOS_STATE.md (master state document)
- [ ] Redesign app navigation around roles
- [ ] Build in-app "Talk to [Role]" agent panel (Claude API)
- [ ] Create knowledge files for all roles (COO first, then CMO, then others)

---

*This document is the founding vision for the Steel Hearts Operating System and the HonorBase product. Update at the architecture session.*
