# Steel Hearts Finance — Rolling TODO
> This file is the canonical backlog for the monthly finance build-out.
> At the start of every finance session, Claude reads this file and picks up where we left off.
> At the end of every session, Claude updates this file with what was completed + what's next.

---

## HOW THIS WORKS
- Monthly Close sessions (first Monday of month) = close the prior month + work 1-2 items from this list
- Weekly Reconciliation sessions (Wednesdays) = historical reconciliation + 1-2 items from this list
- Each session: Claude reads this file first, summarizes what's next, and we go

---

## ✅ COMPLETED

### App Foundation
- [x] Finance section built (6 pages: Overview, Report, Disbursements, Expenses, Donations, Close, Archive)
- [x] 8-section monthly report auto-assembled from Salesforce
- [x] Chase CSV upload + auto-categorization (40+ rules) → Expense__c
- [x] isBracelet logic fixed (all bracelets vs obligation-generating)
- [x] Timezone fix in SOQL (ET boundary: T05:00:00.000Z)
- [x] Disbursements page (/finance/disbursements) — shows what to pay, to whom, how
- [x] DisbursementSendForm — mark as sent → writes Donation_Disbursement__c
- [x] Excel export (multi-sheet .xlsx matching Sara's workbook format)
- [x] Sidebar active state fix for finance sub-pages

### Data Quality (2026)
- [x] Deleted 77 duplicate Zapier records (Afbu*/Afbv* prefix)
- [x] Created missing orders #15948 (Wentz) and #15949 (Corma)
- [x] Fixed swapped prices on order #16071 (LORIMER/FOSTER)
- [x] Cleaned 17 additional Jan 2026 records (ghost $0 items, legacy SKUs)
- [x] Linked DON-0014 to Travis Manion Foundation Account

### Validation
- [x] Feb 2026 FULLY VALIDATED — 147 bracelets, $1,470 obligations, $520 SH Fund
- [x] Jan 2026 FULLY VALIDATED — 183 bracelets sold (133 obligation-generating + 50 bulk CASHH)

### Receipts
- [x] 370 Gmail donation receipts collected (2017-2026) → data/donation-receipts.json

### Calendar
- [x] March 30 Monthly Close scheduled
- [x] April 1 Historical Reconciliation scheduled (updated)
- [x] Recurring Monthly Close (first Monday, starting May 4)
- [x] Weekly Reconciliation series (16 weeks, Wednesdays starting April 8)

---

## 🔴 BLOCKING — Must do before March 30 close

- [ ] **Create SF fields on Donation_Disbursement__c**
  - Cycle_Month__c (Number, 2)
  - Cycle_Year__c (Number, 4)
  - Receipt_Captured__c (Checkbox, default false)
  - → Go to: SF Setup → Object Manager → Donation_Disbursement__c → Fields & Relationships → New
  - Without these, the disbursements page can't filter by cycle and Mark as Sent won't save cycle info

- [ ] **Create Expense__c custom object in SF**
  - Fields: EXP-{auto}, Date__c, Amount__c, Vendor__c, Category__c, Description__c, Account_Source__c, Month__c, Year__c, Approved__c
  - → SF Setup → Object Manager → Create → Custom Object
  - Without this, expense uploads have nowhere to save in Salesforce

---

## 🟡 HIGH PRIORITY — Work through in next 2-3 sessions

- [ ] **Validate March 2026 report** (do on March 30 close session)
  - Compare /finance/report?month=3&year=2026 against Squarespace export
  - Check Sheet 8 (Data Issues) — each item is a finance gap + family outreach lead

- [ ] **Historical reconciliation** (April 1 session + weekly Wednesdays)
  - 370 receipts in data/donation-receipts.json
  - Match to SF Donation_Disbursement__c records
  - Create SF records for unmatched batches
  - See FINANCE_TODO for known mass execution days below

- [ ] **Research Tasks page** — /finance/research or integrated into Sheet 8
  - Data issues from monthly report → actionable research tasks
  - Each task: missing org, family not linked, unmatched SKU
  - Dual purpose: finance accuracy + family outreach lead
  - Assign to volunteer, track resolution

- [ ] **Verify Excel export format matches Sara's workbook exactly**
  - Open Sara's most recent workbook and compare structure
  - Adjust column headers, formatting, sheet order if needed

- [ ] **Test Monthly Close email draft to Sara**
  - /finance/close → export → verify Gmail draft creates correctly
  - Check attachment, subject line, body copy

---

## 🟢 QUEUED — Build when we get to it

- [ ] **Stripe /donate page stub + webhook** (when new website is live)
  - Stub exists: /api/stripe/donation-webhook/route.js
  - When ready: add STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET to env
  - Register webhook in Stripe Dashboard
  - Apply for Stripe nonprofit rate: stripe.com/nonprofits (0.5% + $0.30)
  - **Check if nonprofit account already exists first** (check stripe.com/dashboard → Settings → Account → Business type)

- [ ] **Obligation Tracker improvements**
  - Per-org "last disbursed" date
  - Flag orgs with 2+ years of outstanding balance and no recent contact
  - Link directly to hero record and family contact

- [ ] **Recurring donation tracking**
  - When Stripe webhook is live, track recurring vs one-time
  - Show recurring donors in Donation__c with recurring flag

- [ ] **QuickBooks sync** (if Sara needs it)
  - Monthly report → export in QB-compatible format
  - Or: direct QB API integration
  - Discuss with Sara whether this is needed

- [ ] **Fallen Wings Foundation** — reconcile receipts before drawing any conclusions
  - SF shows 4 heroes linked: Sletten ($420), Hamilton ($20), Allen ($20), Kincade ($10) = $470 in obligations generated
  - SF shows 0 Donation_Disbursement__c records for FWF — but this does NOT mean nothing was paid
  - The reconciliation project exists precisely because payments were made without being recorded in SF
  - ACTION: Search donation-receipts.json for Fallen Wings Foundation entries during April 1 session
  - Outstanding_Donations__c on FWF Account is showing $0 — rollup formula likely not wired correctly, investigate

---

## 📋 KNOWN MASS DISBURSEMENT EXECUTION DAYS (for reconciliation)
Sep 2018, Jul 2019, Dec 2019, Sep 2020, Apr 2021, Aug 2022, Oct 2022, Feb 2024, Sep-Nov 2025, Jan-Mar 2026

---

## 📝 SESSION LOG
| Date | Session | Completed | Next |
|------|---------|-----------|------|
| 2026-03-27 | Build session | App foundation, data cleanup, calendar setup | March 30 close |
