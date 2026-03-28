# COO Knowledge File
**Role:** Chief Operating Officer
**Last Updated:** 2026-03-28
**Session Count:** 2

---

## Role Definition
The COO owns everything from hero intake request to bracelet on a family's wrist. Design files, laser production, ShipStation, inventory — the full physical product lifecycle.

---

## Current State (as of 2026-03-28, post-Session 2)

| Metric | Count |
|--------|-------|
| Active Orders (non-Fulfilled / non-Cancelled) | ~16 (5 closed this session) |
| Heroes in Intake Pipeline | 4 |
| Heroes Active on Website | 0 |
| Order Items — Needs Decision | 0 (Capodanno items resolved) |
| Order Items — Ready to Laser | 3 (USN-CAPODANNO-6, -6D, -7D) |
| Order Items — Design Needed | 3 (USMA94-GEORGE-7, USMA23-MORTON-6D, USMA-ARMYRUGBY-7 x2) |
| Order Items — Ready to Ship | 1 (USAFA07-HELTON — in ShipStation) |

### Orders Closed This Session
| Order # | Action |
|---------|--------|
| 15948 | Marked Fulfilled — items were Army Rugby (old, already shipped) |
| 15949 | Marked Fulfilled — items were Army Rugby (old, already shipped) |
| 16115 | Marked Fulfilled — shipped by Joseph via ShipStation |
| 16114 | Marked Fulfilled — shipped by Joseph via ShipStation |
| 16117 | Located and verified in system — Sara Sexton order |

### Order Fulfillment Status Breakdown (estimated post-session)
- **Pending:** ~12
- **Unfulfilled:** 2 (DON-BALDWIN, DON-HELTON — Helton now in ShipStation)
- **Fulfilled (closed this session):** 5

### Hero Pipeline Stage Breakdown (unchanged)
- **Family Outreach:** 2
- **Intake:** 1
- **Charity Designation:** 1

---

## Active Pipeline

### Heroes in Intake (Memorial_Bracelet__c)
| Name | Branch | Pipeline Stage | Design Status | SKU | Active Listing |
|------|--------|---------------|--------------|-----|---------------|
| ZEUS 95 — KC-135 Crew Memorial | USAF | Family Outreach | Not Started | USAF-ZEUS95 | No |
| Maj. John "Alex" Klinner | USAF — 99th ARS | Family Outreach | Not Started | USAF-KLINNER | No |
| LCpl George Hooley | British Army — Para Regt | Intake | Not Started | BA-HOOLEY | No |
| Maj. Moises A. Navas | USMC — MARSOC | Charity Designation | Complete | USMC-NAVAS | No |

---

## Orders Requiring Action

### Laser Queue (Ready to Laser)
| Item Name | SKU | Notes |
|-----------|-----|-------|
| LT Vincent Robert Capodanno | USN-CAPODANNO-6 | 6" female cut design in SF Files |
| LT Vincent Robert Capodanno | USN-CAPODANNO-6D | 6" female cut design in SF Files |
| LT Vincent Robert Capodanno | USN-CAPODANNO-7D | 7" standard design in SF Files |

### Design Needed
| Item Name | SKU | Notes |
|-----------|-----|-------|
| MAJ Jason E. George (USMA '94) | USMA94-GEORGE-7 | SVG not yet created |
| 1LT Turner H. Morton III (USMA '23) | USMA23-MORTON-6D | SVG not yet created |
| Army Rugby Football Club | USMA-ARMYRUGBY-7 | SVG not yet created (qty 2) |

### Ready to Ship / In ShipStation
| Item Name | SKU | Notes |
|-----------|-----|-------|
| 1st Lt Joseph D. Helton Jr. (USAFA 07) | USAFA07-HELTON | Pushed to ShipStation order 267905468. Ship to: Jiffy Helton Sarver, 650 Trillium Lane, Lilburn GA 30047 |
| 1LT Turner H. Morton III (USMA '23) | USMA23-MORTON-7 | Previously Ready to Ship — confirm ShipStation label created |
| 1LT Turner H. Morton III (USMA '23) | USMA23-MORTON-6D | Previously Ready to Ship — confirm ShipStation label created |
| LT Vincent Robert Capodanno | USN-CAPODANNO-7 | Previously Ready to Ship — confirm ShipStation label created |

---

## Active Todos

### Blocking
- Create ShipStation labels for MORTON-7, MORTON-6D, CAPODANNO-7 — these were "Ready to Ship" before session; confirm labels exist and packages are out.
- Laser USN-CAPODANNO-6, USN-CAPODANNO-6D, USN-CAPODANNO-7D — designs are in SF Files, accessible via /api/designs/download?sku= in the app.

### High Priority
- Create SVG designs for USMA94-GEORGE-7, USMA23-MORTON-6D, USMA-ARMYRUGBY-7 (x2).
- 2 heroes in Family Outreach stage — follow up with families to advance through pipeline.

### Queued
- Confirm Helton ShipStation label printed and package shipped.
- 1 hero in Charity Designation stage (Navas) — confirm designated charity before advancing to design.
- 1 hero in Intake stage (Hooley) — complete intake data collection.
- Fix Google Drive service account authorization — service account needs Drive scopes granted in Google Admin Console for design upload pipeline to work. For now, designs live in SF Files.

---

## Design File Architecture

### How Design Files Are Stored
- **Primary:** SF Files (ContentDocumentLink on Memorial_Bracelet__c record)
- **Access in app:** `/api/designs/download?sku=SKU-HERE` — proxy route, size-aware, requires no auth from browser
- **Drive upload:** Intended to also live in Google Drive "Bracelet Designs" folder (ID: `1NdTzHZTYUNkwIOFRp-DDcac0ypXFQjbj`) but service account Drive auth is not yet configured. **Blocked until Google Admin Console grants Drive scopes to the service account.**

### Size-Specific Design Logic
- SKUs ending in `-6` or `-6D` → looks for SVG with "female cut", "FEMALE", or "SMALL" in title, or `-6` suffix
- SKUs ending in `-7` or `-7D` → looks for SVG with `-7` suffix or falls back to base design
- If only one SVG attached to the memorial → served for all variants

### Capodanno Design Files (as of 2026-03-28)
| File | Title in SF | Variant |
|------|------------|---------|
| ContentVersion 068V500000Z0jp3IAB | Capodanno_USN-CAPODANNO | 7" standard |
| ContentVersion 068V500000Z0fNFIAZ | Capodanno_Female Cut_USN-CAPODANNO | 6" female cut |

---

## Salesforce Schema Reference

### Objects
- **Orders:** Squarespace_Order__c
- **Order Items:** Squarespace_Order_Item__c
- **Heroes / Bracelets:** Memorial_Bracelet__c (Note: there is no Hero__c object)
- **Role Knowledge Files:** SHOS_Knowledge__c
- **Friction / Issues Log:** SHOS_Friction__c

### Key Field Names
| Concept | Object | Field |
|---------|--------|-------|
| Order status | Squarespace_Order__c | Fulfillment_Status__c |
| Order total | Squarespace_Order__c | Order_Total__c |
| Item production status | Squarespace_Order_Item__c | Production_Status__c |
| Item SKU | Squarespace_Order_Item__c | Lineitem_sku__c |
| Item bracelet size | Squarespace_Order_Item__c | Bracelet_Size__c (not reliable — use SKU suffix as source of truth) |
| Hero link on item | Squarespace_Order_Item__c | Memorial_Bracelet__c |
| Hero branch | Memorial_Bracelet__c | Service_Academy_or_Branch__c |
| Hero pipeline stage | Memorial_Bracelet__c | Pipeline_Stage__c |
| Hero design status | Memorial_Bracelet__c | Design_Status__c |
| Standard design URL | Memorial_Bracelet__c | Design_Brief__c (text field, URL extracted via regex) |
| 6" design URL | Memorial_Bracelet__c | Design_Brief_6in__c (added Session 2) |
| Knowledge file role | SHOS_Knowledge__c | Role__c |
| Knowledge file content | SHOS_Knowledge__c | Content__c |

### Key Order Fulfillment Statuses
Pending, Unfulfilled, Ready to Ship, Fulfilled, Cancelled, cancelled

### Key Production Statuses (Order Items)
Needs Decision, Design Needed, Design In Progress, Ready to Laser, In Production, Ready to Ship, Shipped

### Key Pipeline Stages (Memorial_Bracelet__c)
Intake, Family Outreach, Charity Designation, Design, Production, Donated Fulfillment, Website Listing, Active, Research, Sunset

### SKU Naming Convention
`BRANCH-LASTNAME-SIZE` where SIZE is:
- `-7` = 7" regular
- `-6` = 6" small
- `-7D` = 7" donated variant ($45, extra $10 → Steel Hearts Foundation, not hero's charity)
- `-6D` = 6" donated variant ($45, extra $10 → Steel Hearts Foundation, not hero's charity)

**D variant clarification:** The extra $10 on D variants goes to Steel Hearts Foundation specifically. The hero's designated charity always gets its $10 from the base $35 price regardless of variant.

---

## SOPs Referenced
- COO-001: Hero intake process
- COO-002: Laser production run
- COO-003: ShipStation fulfillment

---

## Decision Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Knowledge file initialized | First COO session — baseline state documented from live SF data |
| 2026-03-28 | Corrected field names from schema | Hero__c does not exist; Memorial_Bracelet__c is the correct object. Various field name corrections. |
| 2026-03-28 | SKU is source of truth for size | Bracelet_Size__c field not reliably set on import. SKU suffix (-6, -7, -6D, -7D) is authoritative. |
| 2026-03-28 | Design downloads route through SF proxy | Google Drive service account not yet authorized. SF Files + /api/designs/download proxy is the working architecture. |
| 2026-03-28 | Design_Brief_6in__c added to Memorial_Bracelet__c | Per-size design URL field added to support 6" variant downloads separately from standard 7" design. |
| 2026-03-28 | D variant meaning | D suffix = $45 price point. Extra $10 goes to Steel Hearts Foundation specifically (not hero's charity). Hero's charity always gets $10 from base $35. |

---

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-28 | Initial knowledge file created from SF data pull. Found 21 active orders, 4 heroes in pipeline, 13 items needing attention (5 Needs Decision, 4 Design Needed, 4 Ready to Ship). SHOS_Knowledge__c missing custom fields — record saved with Name only; markdown saved locally as well. |
| 2026-03-28 | Session 2 — Major SHOS app build session. Fixed: OrderBoard now shows Needs Decision orders; size display uses SKU as source of truth; added Design_Brief_6in__c field to Memorial_Bracelet__c; design downloads routed through SF proxy (/api/designs/download) instead of direct Drive links; Capodanno Needs Decision items resolved to Ready to Laser (design files found in SF Files); Helton donated order found address and pushed to ShipStation (order 267905468); orders 15948/15949 patched (Army Rugby items, old shipped orders) and marked Fulfilled; orders 16115, 16114 marked Fulfilled (shipped by Joseph); SHOS_Knowledge__c and SHOS_Friction__c custom fields deployed with FLS; COO knowledge file written to SF. Google Drive service account auth issue discovered — blocked on Google Admin Console configuration. |
