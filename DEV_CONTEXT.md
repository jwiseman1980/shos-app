# Development — Knowledge File
> Read this at the start of every Dev session. Update it at close.
> **Owns:** Money coming in beyond bracelet sales.

**Role:** Director of Development
**Knowledge file:** DEV_CONTEXT.md
**App section:** /dev
**Last updated:** 2026-03-27

---

## Role Definition

The Director of Development owns every dollar that comes in beyond bracelet sales:
- Individual donor cultivation and stewardship
- Stripe donation page (stub exists, activates with new website)
- Grant research and applications
- Corporate and foundation partnerships
- Impact reporting to donors
- Campaign planning

**Write permissions:** DEV_CONTEXT.md, Donation__c records, donor notes in SF
**Flag to CFO, do not fix:** Revenue recognition, donation receipt generation, financial reporting
**Coordinate with Comms:** Campaign content, donor impact stories for social

---

## Current State

**As of 2026-03-27 (first Dev knowledge file entry — baseline TBD in first Dev session):**

- Donors page live: 265 Donation__c records in Salesforce
- Stripe stub: ready, activates with new website (STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET needed)
- Campaigns: none active
- Grants: none in pipeline
- Donor segments: not yet computed (run compute-segments)

**This is the highest-value unbuilt role.** Revenue from individual donors, grants, and partners could meaningfully increase Steel Hearts' mission impact. The infrastructure is here. The strategy needs building.

---

## Active Todos

**🔴 HIGH PRIORITY**
- [ ] Dev knowledge file initialization — run first Dev session to establish baseline state
- [ ] Run donor segmentation — compute-segments to categorize all 265 donors

**🟡 MEDIUM PRIORITY**
- [ ] Donor segment review — cultivation, active, lapsed, high-value
- [ ] Year-end thank you + impact emails (if not already sent for 2025)
- [ ] Fundraising strategy session — what campaigns make sense for Steel Hearts?

**🟢 QUEUED**
- [ ] Grant research — identify foundations aligned with Gold Star families
- [ ] Campaigns page in app (/dev/campaigns)
- [ ] Grants page in app (/dev/grants)
- [ ] Stripe donation webhook activation (when new website is live)
- [ ] Check Stripe nonprofit status: stripe.com/dashboard → Settings → Account → Business type
- [ ] Apply for Stripe nonprofit rate (0.5% + $0.30) at stripe.com/nonprofits

---

## Donor Segments (TBD — run compute-segments)

| Segment | Count | Last Contact | Next Action |
|---------|-------|--------------|-------------|
| High Value | TBD | TBD | TBD |
| Active | TBD | TBD | TBD |
| Cultivation | TBD | TBD | TBD |
| Lapsed | TBD | TBD | TBD |

---

## SOPs Referenced

| SOP | Name | Status |
|-----|------|--------|
| (TBD) | Donor Cultivation Email | Undocumented |
| (TBD) | Impact Update Emails | Skills exist, SOP not formalized |
| (TBD) | Grant Research Process | Not started |
| (TBD) | Year-End Donor Report | Skills exist |

---

## Session Log

| Date | What Happened | Next |
|------|---------------|------|
| 2026-03-27 | Knowledge file created. Baseline state not yet established. | First Dev session: donor segmentation, fundraising strategy, gap analysis. |
