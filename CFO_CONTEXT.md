# CFO — Knowledge File
> Read this at the start of every CFO session. Update it at close.
> **Owns:** All money in and out.
> *Formerly FINANCE_TODO.md — expanded to full knowledge file format 2026-03-27*

**Role:** CFO
**Knowledge file:** CFO_CONTEXT.md
**App section:** /finance
**Last updated:** 2026-03-27

---

## Role Definition

The CFO owns every dollar that flows through Steel Hearts:
- Bracelet sales → obligation tracking ($10/bracelet rule, D-variant = +$10 SH Fund)
- Disbursement execution, cycle management, receipt capture
- Expense tracking (Chase CSV → Expense__c)
- Incoming donations (Stripe when new website is live)
- Monthly close and reporting to Sara Curran / Tracy (CPA)
- Historical reconciliation (FIN-RECON-002 — 370 receipts, 2017-2026)
- Recon matrix — 184 partner orgs, Gmail receipts × SF records
- Financial compliance support (990 prep, audit trail)

**Write permissions:** CFO_CONTEXT.md, all Salesforce financial objects (Expense__c, Donation_Disbursement__c, Donation__c), Chase CSV uploads
**Flag to COO, do not fix:** Bracelet pricing or SKU changes
**Flag to ED, do not fix:** Decisions about compensation, strategic budget allocations

---

## Current State

**As of 2026-03-27:**

Finance section fully built — 8 pages live:
- Overview, Monthly Report, Disbursements, Recon Matrix, Expenses, Donations, Monthly Close, Archive

Feb 2026: FULLY VALIDATED — 147 bracelets, $1,470 obligations, $520 SH Fund
Jan 2026: FULLY VALIDATED — 183 bracelets sold (133 obligation-generating + 50 bulk CASHH)
March 2026: Not yet validated — run on March 30 close

370 Gmail donation receipts collected (2017-2026) → data/donation-receipts.json
Recon matrix live: 184 partner orgs × Gmail receipts × SF disbursement records

---

## Active Todos

### 🔴 BLOCKING — Must do before March 30 close

- [ ] **Create SF fields on Donation_Disbursement__c**
  - Cycle_Month__c (Number, 2)
  - Cycle_Year__c (Number, 4)
  - Receipt_Captured__c (Checkbox, default false)
  - → SF Setup → Object Manager → Donation_Disbursement__c → Fields & Relationships → New

- [ ] **Create Expense__c custom object in SF**
  - Fields: EXP-{auto}, Date__c, Amount__c, Vendor__c, Category__c, Description__c, Account_Source__c, Month__c, Year__c, Approved__c
  - → SF Setup → Object Manager → Create → Custom Object

### 🟡 HIGH PRIORITY

- [ ] **Validate March 2026 report** (March 30 close session)
  - Compare /finance/report?month=3&year=2026 against Squarespace export
  - Check Sheet 8 (Data Issues) — each item is a finance gap + family outreach lead

- [ ] **Historical reconciliation** (April 1 session + weekly Wednesdays)
  - 370 receipts in data/donation-receipts.json
  - Match to SF Donation_Disbursement__c records
  - Create SF records for unmatched batches
  - Known mass execution days: Sep 2018, Jul 2019, Dec 2019, Sep 2020, Apr 2021, Aug 2022, Oct 2022, Feb 2024, Sep-Nov 2025, Jan-Mar 2026

- [ ] **Research Tasks page** — /finance/research or integrated into Sheet 8
  - Data issues from monthly report → actionable research tasks
  - Each task: missing org, family not linked, unmatched SKU
  - Dual purpose: finance accuracy + family outreach lead

- [ ] **Verify Excel export format matches Sara's workbook exactly**

- [ ] **Test Monthly Close email draft to Sara**
  - /finance/close → export → verify Gmail draft creates correctly

### 🟢 QUEUED

- [ ] **Stripe /donate page stub + webhook** (when new website is live)
  - Stub exists: /api/stripe/donation-webhook/route.js
  - Check if nonprofit account already exists: stripe.com/dashboard → Settings → Account → Business type
  - Apply for Stripe nonprofit rate: stripe.com/nonprofits (0.5% + $0.30)

- [ ] **Obligation Tracker improvements**
  - Per-org "last disbursed" date
  - Flag orgs with 2+ years of outstanding balance and no recent contact
  - Link directly to hero record and family contact

- [ ] **Fallen Wings Foundation reconciliation**
  - SF shows 4 heroes: Sletten ($420), Hamilton ($20), Allen ($20), Kincade ($10) = $470 obligations
  - 7 Gmail receipts found (2020-2025) — all show null amounts (email-only confirmations)
  - Amounts must be found in bank statements or original emails during April 1 session
  - Outstanding_Donations__c on FWF Account shows $0 — rollup formula likely broken

- [ ] **QuickBooks sync** — discuss with Sara whether needed

---

## FIN-RULES-001 (Obligation Logic)

| Condition | isBracelet | generatesObligation | Amount |
|-----------|-----------|---------------------|--------|
| Any non-empty SKU | ✓ | depends on price | — |
| Unit price = $35 | ✓ | ✓ | $10 → charity partner |
| Unit price = $45 (D-variant) | ✓ | ✓ | $10 → charity + $10 → SH Fund |
| Any other price | ✓ | ✗ | $0 obligation |
| CASHH bulk orders | ✓ | ✗ | $0 obligation |

SF rollup fields (Total_Donations_From_Bracelets__c, Outstanding_Donations__c) are broken/null.
Actual obligation data lives in hero-level Funds_Donated__c — aggregated in recon-matrix.js.

---

## SOPs Referenced

| SOP | Name | Cadence | Status |
|-----|------|---------|--------|
| SOP-FIN-001 | Monthly Financial Close | Monthly (first Monday) | Active |
| SOP-FIN-002 | Bracelet Obligation Tracking | Per order cycle | Active |
| FIN-RECON-002 | Historical Receipt Reconciliation | Weekly (Wednesdays) | Active through July 2026 |

---

## Decision Log

| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-27 | Delete Donorbox integration | $17/month premium required for API. Replaced with Stripe stub. |
| 2026-03-27 | Absence of SF records ≠ payments not made | FIN-RECON-002 exists because payments were made without SF records. Never conclude $0 owed from missing records alone. |
| 2026-03-27 | isBracelet vs generatesObligation separated | isBracelet = any non-empty SKU. generatesObligation = $35 or $45 only. Fixed in orders.js. |

---

## Session Log

| Date | Session | Completed | Next |
|------|---------|-----------|------|
| 2026-03-27 | Architecture + Build | App foundation, data cleanup, calendar setup, recon matrix, disbursements page, Donorbox deleted, Stripe stub created, FINANCE_TODO.md → CFO_CONTEXT.md | March 30 Monthly Close |
