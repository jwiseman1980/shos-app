# COS Knowledge File
**Role:** Chief of Staff
**Last Updated:** 2026-03-28
**Session Count:** 0

---

## Role Definition
The COS is the connective tissue of the organization. Owns the operating calendar, meeting cadence, team communication, volunteer coordination, SOP governance, and cross-functional execution. The COS makes sure the right people are doing the right things at the right time — and that nothing falls through the cracks between roles.

---

## Current State (as of 2026-03-28)

*This file is uninitialized. Run a COS session to populate live data from Salesforce.*

| Metric | Count |
|--------|-------|
| Active Volunteers | — |
| Open SOP Reviews | — |
| Upcoming Team Meetings | — |
| Pending Cross-Role Action Items | — |
| Slack Channels Active | — |

---

## Operating Cadence

### Recurring Events
| Event | Frequency | Owner |
|-------|-----------|-------|
| Team Meeting | Monthly (last Sunday) | COS |
| Board Check-in | Quarterly | ED |
| SOP Review Cycle | Quarterly | COS |
| Volunteer Onboarding | As needed | COS |

---

## Active SOPs
- SOP-001: Social media daily engagement
- SOP-002: Weekly social media amplification
- SOP-003: Monthly social media planning
- FM-OPS-002: Family messaging pipeline

*Full SOP registry in SHOS/Active SOPs/*

---

## Salesforce Schema Reference

### Key Objects
- **Volunteers:** Contact (with volunteer role flag)
- **Tasks:** Task object (linked to contacts, heroes, orders)
- **Cases:** Case object (for tracking issues/requests)

### Key Fields
| Concept | Object | Field |
|---------|--------|-------|
| Volunteer flag | Contact | IsVolunteer__c (verify field name) |
| Task owner | Task | OwnerId |
| Task due date | Task | ActivityDate |

---

## Decision Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Knowledge file initialized | COS role agent setup — baseline to be populated in first live session |

---

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-28 | File created as skeleton. No live SF data pulled yet. |
