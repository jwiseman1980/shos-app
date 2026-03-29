# Steel Hearts: Supabase Migration Prompt

**Hand this to a separate Claude Code thread to execute the migration.**

---

## Context

Steel Hearts is migrating from Salesforce as primary database to Supabase (PostgreSQL). The SHOS App is a Next.js 13+ app deployed on Vercel at `C:\Users\JosephWiseman\OneDrive - Steel-Hearts.org\AI Projects\SHOS\shos-app`.

**Architecture decision (2026-03-28):**
- **Supabase** = primary database (app reads/writes real-time)
- **Salesforce** = nightly backup mirror (read-only compliance copy)
- **Notion** = being decommissioned (all data moves to Supabase)

## What You Need To Do

### Phase 1: Supabase Project Setup

1. **Create a new Supabase project** for Steel Hearts (separate from GYST).
   - Project name: `steel-hearts` or `shos`
   - Region: US East (closest to Vercel deployment)
   - Get the project URL and anon/service keys

2. **Run the schema** at `shos-app/supabase-schema.sql` against the new project.
   - This creates 22 tables, enums, indexes, triggers, and RLS policies.
   - Verify all tables created successfully.

3. **Add environment variables** to the SHOS app:
   - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public anon key
   - `SUPABASE_SERVICE_ROLE_KEY` — Server-side service key (never expose to client)
   - Add to both `.env.local` and Vercel environment settings.

4. **Install Supabase client** in the app:
   ```bash
   npm install @supabase/supabase-js
   ```

5. **Create Supabase client utilities** at `lib/supabase.js`:
   - Server client (using service role key) for API routes
   - Browser client (using anon key) for client components
   - Follow the pattern already used in GYST if helpful

### Phase 2: Build New Tables First (no migration risk)

Build the app pages for the NEW Supabase-only tables. These have no SF data to migrate — they start fresh:

1. **Tasks** (`/tasks` or integrate into existing role pages)
   - Full CRUD: create, list, edit, delete, status transitions
   - Filter by: assigned_to, status, role, due_date
   - Kanban board view (like the existing `/orders` page)
   - Per-person "My Tasks" view

2. **Volunteers** (`/volunteers` — route already exists as stub)
   - Full CRUD: add volunteer, update status, track onboarding
   - List view with status filters
   - Onboarding checklist per volunteer

3. **Engagements** (could be a tab on existing pages or standalone)
   - Log engagement entries
   - Filter by type, date, organization, contact

4. **Decisions** (could be part of a governance or system page)
   - Log decisions with reasoning
   - Filter by domain, role, date

### Phase 3: Migrate Existing SF Data

This is the big one. For each SF object, you need to:
1. Read all records from Salesforce via existing API routes
2. Transform field names (SF `__c` → Supabase snake_case)
3. Insert into Supabase tables
4. Verify record counts match

**Field mapping reference:**

The existing SF data layer is at `lib/data/`. Each file shows the SOQL queries and field names used. Key mappings:

| SF Object | Supabase Table | SF ID Field | Key Fields to Map |
|-----------|---------------|-------------|-------------------|
| Memorial_Bracelet__c | heroes | Id → sf_id | First_Name__c → first_name, Last_Name__c → last_name, Active_Listing__c → active_listing, Memorial_Date__c → memorial_date, Lineitem_sku__c → lineitem_sku, etc. |
| Contact | contacts | Id → sf_id | FirstName → first_name, LastName → last_name, Email → email |
| Account | organizations | Id → sf_id | Name → name, Total_Donations_From_Bracelets__c → total_obligations, Total_Disbursed__c → total_disbursed, Outstanding_Donations__c → outstanding_balance |
| Donation__c | donations | Id → sf_id | Donation_Amount__c → amount, Donation_Date__c → donation_date, Source__c → source, etc. |
| Squarespace_Order__c | orders | Id → sf_id | Name → order_number, Order_Type__c → order_type, Order_Date__c → order_date |
| Squarespace_Order_Item__c | order_items | Id → sf_id | Lineitem_sku__c → lineitem_sku, Quantity__c → quantity, Unit_Price__c → unit_price, Production_Status__c → production_status |
| Donation_Disbursement__c | disbursements | Id → sf_id | Amount__c → amount, Disbursement_Date__c → disbursement_date, etc. |
| Expense__c | expenses | Id → sf_id | Transaction_Date__c → transaction_date, Amount__c → amount, Category__c → category |
| Family_Message__c | family_messages | Id → sf_id | Message__c → message, From_Name__c → from_name, Status__c → status |
| Hero_Association__c | hero_associations | Id → sf_id | Memorial_Bracelet__c → hero_id (resolve via sf_id), Contact__c → contact_id (resolve via sf_id) |
| SHOS_Knowledge__c | knowledge_files | Id → sf_id | Role__c → role, Content__c → content |
| SHOS_Friction__c | friction_logs | Id → sf_id | Role__c → role, Description__c → description, Status__c → status |

**Migration order matters** (foreign key dependencies):
1. organizations (no dependencies)
2. contacts (depends on organizations)
3. users (no dependencies — seed from current auth)
4. heroes (depends on contacts, organizations)
5. hero_associations (depends on heroes, contacts)
6. orders (no dependencies)
7. order_items (depends on orders, heroes)
8. donations (depends on contacts)
9. disbursements (depends on organizations)
10. expenses (no dependencies)
11. family_messages (depends on heroes)
12. knowledge_files (no dependencies)
13. friction_logs (depends on users)

**Write a migration script** at `scripts/migrate-sf-to-supabase.mjs` that:
- Connects to SF via existing `lib/salesforce.js`
- Connects to Supabase via service role key
- Migrates each table in dependency order
- Maps SF IDs to UUIDs (store mapping in sf_id column)
- Resolves foreign keys by looking up sf_id → UUID
- Logs progress and errors
- Is idempotent (can be re-run safely using sf_id UNIQUE constraint)

### Phase 4: Update App API Routes

Once data is in Supabase, update each API route to read from Supabase instead of SF.

**Key files to update:**
- `lib/data/heroes.js` → query Supabase `heroes` table
- `lib/data/donations.js` → query Supabase `donations` table
- `lib/data/orders.js` → query Supabase `order_items` + `orders`
- `lib/data/obligations.js` → query Supabase (recalculate from order_items)
- `lib/data/disbursements.js` → query Supabase `disbursements` table
- `lib/data/expenses.js` → query Supabase `expenses` table
- `lib/data/messages.js` → query Supabase `family_messages` table
- `lib/data/bracelets.js` → query Supabase `heroes` table (pipeline view)
- `lib/data/pipeline.js` → query Supabase `heroes` table
- `lib/data/families.js` → query Supabase `contacts`, `heroes`, `organizations`

**Pattern:** Replace `sfQuery()` calls with Supabase client calls. Example:
```js
// Before (Salesforce)
const heroes = await sfQuery("SELECT Id, Name, ... FROM Memorial_Bracelet__c WHERE Active_Listing__c = true");

// After (Supabase)
const { data: heroes } = await supabase
  .from('heroes')
  .select('*')
  .eq('active_listing', true);
```

### Phase 5: Build Nightly SF Sync

Create a sync job that pushes Supabase data to Salesforce nightly.

**File:** `scripts/sync-to-salesforce.mjs`
**Trigger:** Cron job or Vercel cron (`vercel.json` cron config)
**Schedule:** Daily at 2 AM ET

**Logic:**
1. For each table with sf_id mapping:
   - Query Supabase for records updated since last sync
   - Upsert into Salesforce using sf_id
2. Log results to `sf_sync_log` table
3. Handle failures gracefully (log and continue)

### Phase 6: Notion Export

Export the following Notion databases to Supabase:

1. **Steel Hearts Tasks** (DB ID: `2cfd1b69-5cd3-8047-8d35-f2b8fd75d2ee`) → `tasks` table
2. **Anniversary Remembrance Tracker** (DB ID: `393ebb00-8816-4f42-8e06-c007f108d34b`) → merge into `heroes` anniversary fields + `anniversary_emails` table
3. **Graphic Design Tracker** (DB ID: `ae3ec859-5bb6-4d5e-93b4-d56378f73e26`) → merge into `heroes` design fields
4. **Volunteer Onboarding Tracker** (DB ID: `cd5d02ce-1972-48f3-ad74-aac0ce78c47d`) → `volunteers` table
5. **SHOS Engagement Tracker** (DB ID: `f763f835-4862-46b9-9f97-40b88e4fc0ca`) → `engagements` table
6. **SHOS Engagement Decisions** (DB ID: `997a6d87-1ad9-427f-a647-220ed8fbfd63`) → `decisions` table
7. **SHOS Engagement Open Questions** (DB ID: `401f00d1-99c7-4700-beae-a17fb17d5fe7`) → `open_questions` table
8. **SOP Execution Log** (DB ID: `8ac8ac11-c6e4-452e-a7e8-dc78333ff0e8`) → `sop_executions` table
9. **Founder Impact Tracker** → `initiatives` table

Use the Notion MCP tools to fetch each database, map fields to Supabase columns, and insert.

Also export these Notion pages to the filesystem (SHOS/ archive):
- Partnership pages (Whiskey Valor, Event Philosophy, USMA 2016)
- Session notes and architecture proposals
- Anniversary email template pages (~20 drafts) → also insert into `anniversary_emails` table

---

## Critical Rules

1. **NEVER delete SF data.** SF is the backup. Only add/update.
2. **active_listing is sacred.** Only heroes with `active_listing = true` appear on the public website. Preserve this exactly.
3. **Test with a single table first** (e.g., `organizations` — smallest, no complex dependencies). Verify counts match before proceeding.
4. **The app must keep working during migration.** Don't break existing API routes until their Supabase replacements are tested and ready.
5. **sf_id is the sync key.** Every record migrated from SF must have its original SF ID stored in sf_id for bidirectional mapping.

---

## Files to Reference

- Schema: `shos-app/supabase-schema.sql`
- SF connection: `shos-app/lib/salesforce.js`
- SF data layer: `shos-app/lib/data/*.js`
- ED knowledge: `shos-app/ed-knowledge.md`
- App pages: `shos-app/app/*/page.js`
- API routes: `shos-app/app/api/*/route.js`
