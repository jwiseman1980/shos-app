# Dev Knowledge File
**Role:** Developer / Systems
**Last Updated:** 2026-03-28
**Session Count:** 2

---

## Role Definition
Dev owns the SHOS app, Salesforce configuration, integrations, and technical infrastructure. This includes the Next.js app on Vercel, all API routes, Salesforce schema design and maintenance, Google Drive/Gmail integrations, ShipStation, and the knowledge file system itself.

---

## Current State (as of 2026-03-28)

| System | Status |
|--------|--------|
| SHOS App | Live on Vercel (shos-app.vercel.app) |
| Salesforce | Live — steelheartsincorporated.my.salesforce.com |
| Gmail Integration | Live via service account |
| ShipStation | Live |
| Google Drive (design uploads) | Drive scope confirmed present in Admin Console — upload pipeline likely functional, needs test |
| SHOS_Knowledge__c | Live with custom fields (Session 2) |
| SHOS_Friction__c | Live with custom fields (Session 2) |

---

## App Architecture

### Stack
- **Framework:** Next.js (App Router)
- **Hosting:** Vercel
- **Database:** Salesforce (primary), Supabase (secondary/GYST)
- **Auth:** Custom session cookie (HMAC-SHA256)
- **Design Files:** SF Files (ContentDocumentLink on Memorial_Bracelet__c)

### Key Routes
| Route | Purpose |
|-------|---------|
| / | Dashboard |
| /orders | Order board |
| /laser | Laser queue |
| /shipping | Shipping queue |
| /designs | Design management |
| /finance | Finance dashboard |
| /families | Family pipeline |
| /memorials | Hero/memorial management |
| /api/designs/download | SKU-aware SVG proxy from SF Files |
| /api/designs/upload | Upload SVG to Drive + update SF |
| /api/orders | Order CRUD + status updates |

### Key Environment Variables
| Variable | Purpose |
|----------|---------|
| SF_CLIENT_ID | Salesforce OAuth client ID |
| SF_REFRESH_TOKEN | Salesforce OAuth refresh token |
| SF_LIVE | "true" to enable live SF writes |
| SHOS_API_KEY | API auth for server-to-server calls |
| GDRIVE_DESIGNS_FOLDER_ID | Target Drive folder for SVG uploads |
| GOOGLE_SERVICE_ACCOUNT_EMAIL | shos-gmail-service@shos-490912.iam.gserviceaccount.com |
| GOOGLE_SERVICE_ACCOUNT_KEY | Private key (PEM) |
| SESSION_SECRET | Cookie signing secret |

---

## Salesforce Schema — Key Objects
| Object | Purpose |
|--------|---------|
| Squarespace_Order__c | Orders from Squarespace |
| Squarespace_Order_Item__c | Line items on orders |
| Memorial_Bracelet__c | Heroes / memorial bracelets |
| Donation__c | Donations received |
| Donation_Disbursement__c | Disbursements to charities |
| Account | Organizations (charities, partners) |
| Contact | People (families, volunteers, purchasers) |
| SHOS_Knowledge__c | Role knowledge files |
| SHOS_Friction__c | Friction/issue log |
| Expense__c | Planned — not yet created |

## Key Custom Fields Added (Session 2, 2026-03-28)
- `Memorial_Bracelet__c.Design_Brief_6in__c` — LongTextArea, stores 6" design URL
- `SHOS_Knowledge__c.Role__c`, `Content__c`, `Last_Updated__c`, `Session_Count__c`
- `SHOS_Friction__c.Role__c`, `Type__c`, `Priority__c`, `Description__c`, `Status__c`, `Logged_Date__c`

---

## Known Issues / Technical Debt
| Issue | Priority | Notes |
|-------|----------|-------|
| Google Drive upload — needs live test | Medium | Drive scope confirmed in Admin Console. Test upload via /designs page to verify end-to-end. |
| write-coo-knowledge.mjs is deprecated | Low | Replaced by write-knowledge.mjs [role] |
| migrate-capodanno-svgs-to-drive.mjs | Low | One-off script, can archive |
| Bracelet_Size__c not reliable on import | Low | Fixed in app — SKU is now source of truth |

---

## Scripts Reference
| Script | Usage |
|--------|-------|
| write-knowledge.mjs [role] | Push any role knowledge file to SF |
| create-shos-sf-fields.mjs | Deploy SHOS_Knowledge__c + SHOS_Friction__c custom fields |
| create-shos-sf-objects.mjs | Create the two custom SF objects |
| add-design-brief-6in-field.mjs | Added Design_Brief_6in__c (run once, done) |

---

## Decision Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Knowledge file initialized | Dev role agent setup |
| 2026-03-28 | SF proxy for design downloads | Drive service account not authorized. /api/designs/download uses SF bearer token — reliable and auth-handled. |
| 2026-03-28 | SKU as source of truth for size | Bracelet_Size__c unreliable on import. sizeFromSku() helper added to orders.js. |
| 2026-03-28 | All 7 role knowledge files initialized in SF | ED, COS, CFO, COO, Comms, Dev, Family — all live in SHOS_Knowledge__c |
| 2026-03-28 | Global model set to Opus in settings.json | Better for strategic/architectural sessions. Role agents will use Sonnet/Haiku when built. |
| 2026-03-28 | Agent initialization order decided | ED → COS → individual roles. Mirrors real org information flow. |

---

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-28 | Major build session. Fixed OrderBoard (Needs Decision section), size display, design download routing, Capodanno design files, multiple SF data fixes. Added Design_Brief_6in__c field. Generalized write-knowledge.mjs. Deployed SHOS_Knowledge__c and SHOS_Friction__c custom fields with FLS. |
| 2026-03-28 | Session 2 closeout. Pushed all 7 role skeleton knowledge files to SF. Committed and pushed all session work to git. Confirmed Drive scope already present in Google Admin Console — upload pipeline needs live test. Decided agent init order: ED → COS → individual roles. Global model switched to Opus. |
