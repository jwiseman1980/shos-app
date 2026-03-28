# Family Knowledge File
**Role:** Family Engagement
**Last Updated:** 2026-03-28
**Session Count:** 0

---

## Role Definition
The Family role owns every interaction with Gold Star families. This includes outreach to new families, anniversary remembrance emails, supporter message delivery, bracelet donations to families, and ensuring families feel seen and honored — not processed. Every touchpoint is personal. Automation supports compassion; automation never replaces compassion.

---

## Current State (as of 2026-03-28)

*This file is uninitialized. Run a Family session to populate live data from Salesforce.*

| Metric | Count |
|--------|-------|
| Families in Active Outreach | — |
| Upcoming Anniversaries (30 days) | — |
| Supporter Messages Awaiting Delivery | — |
| Donated Bracelets Pending Shipment | — |
| Families with Active Listings | — |

---

## Active Family Cases

### Heroes in Family Outreach Stage
| Hero | Branch | SKU | Notes |
|------|--------|-----|-------|
| ZEUS 95 — KC-135 Crew Memorial | USAF | USAF-ZEUS95 | Family contact not yet established |
| Maj. John "Alex" Klinner | USAF — 99th ARS | USAF-KLINNER | Family contact not yet established |

---

## Donated Bracelet Pipeline

### Current Donated Orders
| Order | Recipient | Status | Notes |
|-------|-----------|--------|-------|
| DON-HELTON-1774320875679 | Jiffy Helton Sarver | In ShipStation | 650 Trillium Lane, Lilburn GA 30047 |
| DON-BALDWIN-1774460169062 | Bianca Baldwin | Unfulfilled | Address needed |
| DON-2026-001 | Brett Harlow | Pending | Confirm address |

---

## SOPs Referenced
- FM-OPS-002: Family messaging pipeline
- COO-003: ShipStation fulfillment (for donated bracelet shipments)

---

## Communication Rules
- **Never auto-send emails to families.** Always draft → human reviews → human sends.
- **Never use browser automation for social media comments on memorial posts.** API only.
- **All supporter messages are reviewed before delivery.** No exceptions.
- Families get personal responses, not templates — templates are starting points only.

---

## Salesforce Schema Reference

### Key Objects
- **Heroes:** Memorial_Bracelet__c
- **Families:** Contact (Associated_Family_Contact__c on hero record)
- **Donated Orders:** Squarespace_Order__c (Order_Type__c = 'Donated')

### Key Fields
| Concept | Object | Field |
|---------|--------|-------|
| Family contact link | Memorial_Bracelet__c | Associated_Family_Contact__c |
| Pipeline stage | Memorial_Bracelet__c | Pipeline_Stage__c |
| Bracelet sent to family | Memorial_Bracelet__c | Bracelet_Sent__c |
| Memorial date | Memorial_Bracelet__c | Memorial_Date__c |
| Active listing | Memorial_Bracelet__c | Active_Listing__c |
| Order type | Squarespace_Order__c | Order_Type__c ('Donated') |
| Ship to name | Squarespace_Order__c | Shipping_Name__c |
| Ship to address | Squarespace_Order__c | Shipping_Address1__c, City, State, Zip |

### Pipeline Stages (Family-Relevant)
- **Family Outreach** → Making initial contact with family
- **Donated Fulfillment** → Bracelet being produced and shipped to family
- **Active** → Hero has active listing, family relationship established

---

## Decision Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Knowledge file initialized | Family role agent setup — baseline to be populated in first live session |

---

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-28 | File created as skeleton. No live SF data pulled yet. Known: 2 families in outreach (ZEUS95, KLINNER), Helton donated order in ShipStation, Baldwin donated order needs address. |
