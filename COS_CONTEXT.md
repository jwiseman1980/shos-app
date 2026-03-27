# Chief of Staff — Knowledge File
> Read this at the start of every COS session. Update it at close.
> **Owns:** The machine that makes the ED effective.

**Role:** Chief of Staff
**Knowledge file:** COS_CONTEXT.md
**App section:** /cos
**Last updated:** 2026-03-27

---

## Role Definition

The Chief of Staff owns everything that makes the Executive Director effective:
- Daily morning briefing (live)
- Calendar management and session scheduling
- Email routing and triage (live via Gmail API)
- Board governance and compliance calendar
- State registrations
- Decision log — every significant decision recorded
- Meeting prep
- SOP maintenance — create, update, retire procedures
- Master state document (SHOS_STATE.md) — updated each session

**Write permissions:** SHOS_STATE.md, COS_CONTEXT.md, any SOP file, calendar events
**Flag to ED, do not fix:** Strategic decisions, budget approvals, external communications sent on behalf of Steel Hearts

---

## Current State

**As of 2026-03-27:**
- Stop hook configured: fires closeout reminder at every session end
- Architecture session complete: 7-role SHOS structure designed and built
- App navigation redesigned around roles
- All knowledge files initialized

**Live integrations:**
- Gmail API (email triage, draft creation)
- Google Calendar (session scheduling, context loading)
- Salesforce (Task_Log__c for SOP completion tracking)

---

## Active Todos

**🔴 HIGH PRIORITY**
- [ ] Rename FINANCE_TODO.md → CFO_CONTEXT.md (expand to full knowledge file format)
- [ ] Schedule COO, Comms, Family knowledge-file initialization sessions

**🟡 MEDIUM PRIORITY**
- [ ] Create compliance calendar — 990 deadline, state registration renewals, board minutes schedule
- [ ] Audit all active SOPs — which are current, which need updates
- [ ] Build governance section in app (/cos/governance)

**🟢 QUEUED**
- [ ] Board meeting prep template
- [ ] Decision log page in app (currently only in SHOS_STATE.md)
- [ ] Volunteer onboarding SOP
- [ ] Partner relations SOP (PAR-001 through PAR-004 review)

---

## Compliance Calendar

| Item | Deadline | Status | Notes |
|------|----------|--------|-------|
| 990 Filing | ~Nov 2026 (fiscal year end + 4.5mo) | ⚪ Queued | Sara/Tracy handle; COS supports with data |
| VA State Registration | Annual | ⚪ Check status | Verify renewal date |
| Board Meeting Minutes | Ongoing | ⚪ Verify current | Last recorded date unknown |
| State Registrations (active states) | Varies | ⚪ Audit needed | Which states are we registered in? |

---

## SOPs Referenced

| SOP | Name | Cadence | Last Run |
|-----|------|---------|----------|
| SOP-FIN-001 | Monthly Financial Close | Monthly | March 30 (upcoming) |
| SOP-FIN-002 | Bracelet Obligation Tracking | Per order cycle | Active |
| FM-OPS-002 | Supporter Message Pipeline | Weekly | Active |
| PAR-001 through PAR-004 | Partner Engagement | Varies | Review needed |

---

## Decision Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-27 | COS is a separate role from ED | ED makes decisions; COS maintains the machine. Future hire slot. |
| 2026-03-27 | Stop hook configured for closeout reminders | Non-optional: sessions without closeouts didn't happen from system's perspective. |

---

## Session Log

| Date | What Happened | Next |
|------|---------------|------|
| 2026-03-27 | Inaugural COS session. Architecture designed. SHOS_STATE.md and all knowledge files created. Stop hook configured. App redesigned around roles. | First real COS work session: compliance calendar, SOP audit, rename CFO file. |
