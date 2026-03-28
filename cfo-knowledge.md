# CFO Knowledge File
**Role:** Chief Financial Officer
**Last Updated:** 2026-03-28
**Session Count:** 0

---

## Role Definition
The CFO owns the financial integrity of Steel Hearts. This includes monthly close, expense tracking, donation receipt management, obligation tracking (the $10/bracelet charity commitments), disbursement execution, and Sara's monthly financial report. The CFO ensures every dollar in is tracked, every obligation is honored, and every report is accurate.

---

## Current State (as of 2026-03-28)

*This file is uninitialized. Run a CFO session to populate live data from Salesforce.*

| Metric | Value |
|--------|-------|
| Last Monthly Close | February 2026 |
| Outstanding Obligations (est.) | — |
| Undisbursed Funds (est.) | — |
| Pending Receipts | — |
| Open Expense Categories | — |

---

## Monthly Close Process (SOP-FIN-001 / SOP-FIN-002)
1. Download Chase Checking CSV → categorize in app
2. Download Chase CC CSV → categorize in app
3. Pull Donorbox donations
4. Enter other donations (PayPal, checks)
5. Review auto-generated 8-sheet report
6. Resolve data issues (Sheet 8)
7. Joseph reviews & approves
8. Export Excel → email to Sara

---

## Salesforce Schema Reference

### Key Objects
- **Orders:** Squarespace_Order__c
- **Donations:** Donation__c (265 records as of 2026-03-28)
- **Disbursements:** Donation_Disbursement__c
- **Organizations (charities):** Account
- **Expenses:** Expense__c (planned — not yet created)

### Key Fields
| Concept | Object | Field |
|---------|--------|-------|
| Order total | Squarespace_Order__c | Order_Total__c |
| Order type | Squarespace_Order__c | Order_Type__c |
| Donation amount | Donation__c | Amount__c |
| Donation date | Donation__c | Donation_Date__c |
| Disbursement amount | Donation_Disbursement__c | Amount__c |
| Org total donated | Account | Total_Donations_From_Bracelets__c |
| Org total disbursed | Account | Total_Disbursed__c |
| Org outstanding | Account | Outstanding_Donations__c |

### Obligation Model
- Every $35 or $45 bracelet sale generates a $10 obligation to the hero's designated charity
- D-variant bracelets ($45) generate an additional $10 to Steel Hearts Foundation
- Obligations accumulate in Account.Outstanding_Donations__c (manually maintained)
- Disbursements clear obligations via Donation_Disbursement__c records

### Chase Bank Accounts
- **Checking:** ending 2352
- **Credit Card:** ending 3418

---

## Decision Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Knowledge file initialized | CFO role agent setup — baseline to be populated in first live session |

---

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-28 | File created as skeleton. No live SF data pulled yet. Finance section build in progress (see plan file). |
