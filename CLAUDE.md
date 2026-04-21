# CLAUDE.md — Cross-Account Orientation File

> This file is auto-loaded by any Claude Code session opened at `C:\dev`.  
> It is the **cross-account sync mechanism** between Joseph's two Claude accounts (personal + work) — they share the same email but do NOT share session memory.  
> Read this first. Then read `CONSOLIDATION_MASTER_PLAN.md` for the active to-do list.

---

## 1. Who Joseph Is

| Field | Value |
|---|---|
| Name | Joseph Wiseman |
| Email | joseph.wiseman@steel-hearts.org (IS his personal email — not a separate org account) |
| Background | USMA '08, solo operator, runs full personal + professional life through SHOS/GYST |
| Claude accounts | Two accounts, same email, different sessions — **they don't share memory**. This file is the bridge. |
| Memory may be thin | Joseph recently reinstalled Claude Desktop. If session memory feels sparse, it's real — use this file + the master plan. |

**Working style:**
- Decisive. When he says "yes" to a list, execute every item.
- Prefers parallel execution over serial.
- Terse, scannable outputs. Break at thought boundaries.
- Default persistence: Supabase. Notion is deprecated. GDrive/Box fine for files.
- Never auto-send external emails. Always draft → Joseph reviews → Joseph sends.

---

## 2. HonorBase Is the Trunk (CRITICAL)

```
HonorBase (platform / OS for nonprofit EDs)
├── Steel Hearts / SHOS  ← Joseph's own nonprofit; first tenant; primary dev surface
├── DRMF                 ← Drew Ross Memorial Foundation; second tenant; event-focused
└── GYST module          ← "Personal ED life-ops"; lives in Project A (not a separate project)

Side projects (NOT HonorBase):
├── Unknown Signal
└── Sandbox Game
```

**Priority order:** HonorBase trunk > Steel Hearts features > DRMF features > GYST module

When a feature touches multiple products, build it for HonorBase first (shared tables, shared APIs), then wire the tenants in. Do not build DRMF or GYST features in isolation if they belong on the trunk.

---

## 3. Repo Map (`C:\dev`)

| Folder | What it is | Notes |
|---|---|---|
| `honorbase-chat/` | Next.js chat UI — HonorBase operator surface | Active. Commits b778b1f + c381109 on 2026-04-16. Multi-tenant routing live. |
| `honorbase-drmf/` | Next.js, DRMF data/brief/metrics API | Mid-migration to Supabase Project A. JSON flat files being replaced. |
| `AI Projects/SHOS/shos-app/` | Operator dashboard — HonorBase operator layer | Named for Steel Hearts but serves as the ED ops core. Active features shipped Apr 18. |
| `AI Projects/SHOS/steel-hearts-site/` | Public-facing Steel Hearts website | Separate Vercel project from shos-app — never merge |
| `AI Projects/GYST/gyst-dashboard/` | Personal finance / property dashboard | Now points at Project A (Project B dead). Fully seeded. |
| `AI-Projects/` (hyphen, no space) | Parallel folder — drifted from `AI Projects/` | Reconciliation queued. Blocked on OneDrive FileSyncHelper. |
| `notion-export/` | Empty skeleton for Notion → Supabase migration | Content migration plan at `C:\dev\notion-content-migration-plan.md` |
| `scripts/one-offs/` | Misc Python: Squarespace reconciliation, IRS form signing | Some may have loose copies in `C:\dev` root (cleanup queued) |

**Path friction:** `AI Projects` (with space) is the canonical live copy. `AI-Projects` (hyphen) is a drift copy. Shell scripts need quoting. Don't create more scatter.

**Bracelet Design Files:** All SVGs consolidated at `C:\dev\AI Projects\SHOS\Bracelet Design Files\{SKU}\` — 18+ SKU folders, each with `-6.svg` and `-7.svg`. Downloaded from Slack and Salesforce 2026-04-18.

**GitHub:** All 7+ repos have GitHub remotes and are pushed. Workspace meta-repo: `github.com/jwiseman1980/dev-workspace`

**OneDrive:** Deprecated as dev sync mechanism. `C:\dev` is canonical. OneDrive `AI Projects` rename blocked on FileSyncHelper — pause OneDrive sync to unblock.

---

## 4. Supabase Architecture

| Project | Ref ID | Purpose | Status |
|---|---|---|---|
| **Project A — HonorBase** | `esoogmdwzcarvlodwbue` | Renamed "HonorBase" in dashboard. ~50 tables. Single backend for shos-app, honorbase-chat, honorbase-drmf, AND GYST | **Alive and canonical** |
| **Project B — GYST** | `qaxgaeftopnzmvgpzuav` | Deprecated | **Dead — GYST folded into Project A. Do not use.** |

**Project A key tables (as of 2026-04-18):**
- Core: `event_tasks`, `event_sponsors`, `properties` (3 rentals), `execution_log`, `context_log`, `knowledge_files`, `system_config`
- HonorBase platform: `honorbase_orgs`, `org_members`, `org_stream`, `org_knowledge_artifacts`, `platform_knowledge_pool`, `hb_dashboard_cards`
- GYST: `gyst_properties`, `gyst_debts` (4), `gyst_income_sources` (5), `gyst_budget_categories` (10), `gyst_action_items` (17), `gyst_transactions` (584), `gyst_monthly_snapshots`
- Orders/contacts: `orders`, `contacts`, `heroes` (bracelet pipeline tables)
- Events: MMMM 2026 seeded — 16 donors in contacts, $416 raised, $208 disbursement to Legacies Alive created

**Applied migrations:**
- `system_config` — applied 2026-04-16. Squarespace cron unblocked.
- GYST baseline — all 9 gyst_* tables live, seeded with Mar 2026 data
- DRMF org registered in `honorbase_orgs`, Sarah Ross Geisen in `org_members`
- MMMM 2026 event data — applied 2026-04-18

**`hb_dashboard_cards`** upgraded 2026-04-16: added `priority`, `card_type`, `action_url` columns. Daily 5am cron rebuilds cards from `org_stream`.

---

## 5. What Was Built on 2026-04-16

### Infrastructure
- `C:\dev` is canonical. OneDrive deprecated as sync mechanism.
- Workspace meta-repo created: `github.com/jwiseman1980/dev-workspace` (onboarding docs, architecture plan, consolidation tracker)
- All 7+ repos pushed to GitHub with remotes
- GCP SA key rotated. Stray GCP project `shos-490916` shut down.
- Weekly Monday 8am automated health check scheduled

### Supabase (Project A — renamed HonorBase in dashboard)
- `system_config` migration applied — unblocked Squarespace cron
- GYST fully folded into Project A: 9 gyst_* tables, fully seeded
- No Project B. GYST decision is closed.
- DRMF org + Sarah Ross Geisen registered
- `hb_dashboard_cards` upgraded with priority/card_type/action columns
- ~50 tables total

### Code shipped to honorbase-chat (commits b778b1f, c381109)
- `lib/stream.ts` — fire-and-forget org stream logger
- `lib/router.ts` — complexity classifier (Haiku/Sonnet/Opus routing)
- `lib/friction.ts` — behavioral friction detector
- `lib/dashboard.ts` — real-time dashboard card injection
- `lib/knowledge.ts` — knowledge base check + artifact save
- `app/api/cron/generate-dashboard/route.ts` — daily 5am dashboard rebuild
- `app/api/cron/deepen-knowledge/route.ts` — daily 3am knowledge synthesis
- `app/org/[orgSlug]/page.tsx` — multi-tenant routing
- `app/components/ChatApp.tsx` — extracted reusable chat component
- `config/orgs/drmf.js` — DRMF operational context
- `vercel.json` — cron schedules
- `docs/STREAM_ARCHITECTURE.md` — **primary architecture doc** (8 sections, full spec)
- Google auth for org routes (in progress)

### Key architecture decisions
- **HonorBase as a Service:** ED subscribes to HonorBase, not Claude. Claude is invisible engine.
- **Org stream captures everything.** Friction auto-detected. Knowledge deepens daily.
- **Dynamic dashboard** rebuilds from stream data — not static widgets.
- **Knowledge-as-infrastructure:** expensive Opus answers become cheap Haiku lookups over time.
- **Cost curve inverts** — longer a tenant uses HonorBase, cheaper they are to serve.
- **Cross-tenant knowledge pool** — platform gets smarter for everyone.
- **Proactive value:** HonorBase tells the ED what they need before they know to ask.

### DRMF (first external customer)
- URL: `honorbase-chat.vercel.app/org/drmf`
- Sarah Ross Geisen, President, `sarah@drewross.org`
- Knowledge seeded with event data (12 tasks, 6 sponsors, 7 milestones)
- Google auth being wired up

---

## 6. What Was Built on 2026-04-18

### shos-app Deployed Features
- **Inbox with context panels** — auto-hero/contact matching, inline order creation
- **Production pipeline** — 6-column kanban (Received → Queued → Laser → QC → Packaged → Shipped), ShipStation push, Slack notify Ryan
- **Orders page** — filter by donated/paid/wholesale; DON-2026-004 created
- **Events section** — MMMM 2026 live (hit `/api/events/seed-mmmm` to create); 16 donors imported
- **Anniversary tracker** — editable status dropdowns
- **KPI dashboard** — live counts, email → inbox link
- **Sidebar** — badge counts, quick actions

### Orders Written to Supabase
| Order ID | Customer | Items | Status | Address |
|---|---|---|---|---|
| DON-2026-004 | Terrie Lawrence | 10x USMC-LAWRENCE (5x -6, 5x -7) | ready_to_laser | 516 Bayonne Dr, Vandalia OH 45377 |
| TMF 100-unit | Manion Foundation | 100x (Katie to approve) | Pending design approval | — |

### MMMM 2026 Event (Complete)
- $416 raised from 16 donors (Apr 10-11 event)
- All 16 donors written to `contacts` table in Supabase
- $208 disbursement record to Legacies Alive created
- 37 event photos from Kristin Hughes — **NOT YET downloaded** (Drive API access issue; files added to Joseph's Drive but download task froze — resume next session)

### Website Migration State
- 456-URL redirect map built in `next.config.mjs`
- Stripe live key set, webhook registered
- Domains registered in Vercel
- Squarespace renews Oct 22, 2026 — 6 months runway
- Domain renews May 18 via Squarespace ($20/yr)
- **Blocker:** verify `pk_live` publishable key in Vercel env before going live

---

## 7. Active Email Threads (as of 2026-04-18)

| Thread | Status | Next action |
|---|---|---|
| **Terrie Lawrence** (USMC-LAWRENCE bracelets) | Draft reply in Gmail, approved. DON-2026-004 created. | Joseph sends draft → ship order |
| **Tyler Knowlton** (USA-ARCTIC bracelet) | Replied Apr 18. All 3 pilots confirmed. | Wait for response |
| **McLaughlin / Capodanno** | Replied Apr 17, pointed to existing Capodanno bracelet on site | Closed unless they respond |
| **Notion / Ester** | Joseph deleted new account per instructions. Refund ~$637 processing. | Wait for refund |
| **Tracy Hutter / IRS** | Resolved. Penalty abatement letters mailed. | Wait for IRS response |
| **Haith lease** | Sent Apr 18. $3K/mo, Jul 1 2026 start. | Wait for review + pet details |
| **Seb contact form** | Unanswered. Loosely in contact with a family. | Follow up |
| **Kristin Hughes (MMMM photos)** | 37 photos shared via Drive — NOT yet downloaded to disk | Resume Drive download next session |

---

## 8. Design Queue (Ryan)

| SKU | Status | Notes |
|---|---|---|
| FIRE-ALTMAN | Brief sent Apr 17. Ryan acknowledged. | Firefighter Michael "Mickey" Altman, Chicago FD |
| ARMY-GLOVER | Design task posted Mar 30. No delivery yet. | 1LT Richard Glover Jr, USMA '15 |
| All others | Complete | On disk in `Bracelet Design Files/` |

---

## 9. Memory Mirrors

These mirror the "other" Claude account's private session memory. Marked with `source:` as breadcrumbs.

**`source: memory://user_profile`**  
Joseph Wiseman, USMA '08, solo operator running Steel Hearts nonprofit + personal life through a single AI-augmented operating system (SHOS + GYST). Decisive. Voice-first workflow. Prefers the AI to execute, not propose. Every session recorded to calendar. No unrecorded work.

**`source: memory://architecture_honorbase_trunk`**  
HonorBase is the product; Steel Hearts/SHOS is tenant #1 and the primary dev surface. DRMF is tenant #2 (first external customer, live as of Apr 16 2026). GYST is a personal-finance module fully folded into HonorBase Project A. Side projects (Unknown Signal, Sandbox Game) are off-trunk. All architecture decisions should optimize for HonorBase reusability, not single-tenant convenience.

**`source: memory://primary_store_supabase`**  
Supabase is the primary operational database. Notion and Zapier are deprecated. Salesforce is a nightly backup mirror, not a source of truth. Google Drive / Box are fine for files. Never build new features against Notion. Never auto-push to external comms channels.

**`source: memory://project_supabase_architecture`**  
One Supabase project: Project A (`esoogmdwzcarvlodwbue`, renamed "HonorBase" in dashboard, alive, ~50 tables). Project B (`qaxgaeftopnzmvgpzuav`) is dead — GYST folded into Project A as of Apr 16 2026. `system_config` applied. All migrations current.

**`source: memory://project_consolidation_effort`**  
Apr 16 2026: consolidation complete for infrastructure phase. All repos on GitHub. GYST in Project A. DRMF org registered. honorbase-chat multi-tenant routing live. Stream/routing/friction/knowledge libs shipped. Apr 18 2026: shos-app pipeline/inbox/orders live. MMMM 2026 data in Supabase. Bracelet SVGs consolidated to disk. Pending: DRMF data migration, Google auth, OneDrive rename, Notion recovery, MMMM photo download, TMF order approval.

**`source: memory://security_gcp_key_exposure`**  
RESOLVED 2026-04-16. Old GCP SA key for `shos-gmail-service@shos-490912.iam.gserviceaccount.com` rotated. Stray project `shos-490916` shut down. New key at `C:\Users\JosephWiseman\.secrets\shos-signer.json`. All `.bak` files and Downloads copies deleted. No plaintext key material on disk.

---

## 10. Access Checklist (What a Fresh Session Needs)

| Resource | How to access |
|---|---|
| **Supabase** | Logged-in browser (Joseph's login persists in Chrome profile) OR DB password / PAT for `esoogmdwzcarvlodwbue` |
| **Vercel** | Logged-in browser |
| **GitHub** | Logged-in browser (required for pushes) |
| **GCP Console** | Must be logged in as `joseph.wiseman@steel-hearts.org` — **not** `jwisener00@gmail.com` (lacks SA admin roles) |
| **Notion** | Workspace recovery in progress (Ester at Notion handling); not reliably accessible yet |
| **MCP connectors** | Gmail, Google Calendar, Google Drive, Slack, Canva, Notion read-API travel with the Claude install — no browser needed |
| **Supabase CLI** | `supabase login` + `supabase link --project-ref esoogmdwzcarvlodwbue` if Joseph wants CLI-driven migrations |

---

## 11. Key Credentials / Infrastructure

| Item | Value / Location |
|---|---|
| Supabase Project A | `esoogmdwzcarvlodwbue` |
| GCP SA | `shos-gmail-service@shos-490912.iam.gserviceaccount.com` |
| GCP SA Key | `C:\Users\JosephWiseman\.secrets\shos-signer.json` |
| Stripe live secret | In `shos-app/.env.local` (never commit) |
| Stripe publishable key | Verify `pk_live_*` in Vercel env (blocker for website go-live) |
| ShipStation API key | In `shos-app/.env.local` |
| Slack bot token | In `shos-app/.env.local` |
| Domain-wide delegation scopes | gmail.compose, gmail.send, gmail.readonly, gmail.modify, calendar.events, drive, drive.readonly |

---

## 12. Open Security Flags

### GCP Key Exposure (2026-04-16) — RESOLVED

- **Service account:** `shos-gmail-service@shos-490912.iam.gserviceaccount.com`
- **Resolution (2026-04-16):** Old key rotated in GCP. New key at `C:\Users\JosephWiseman\.secrets\shos-signer.json`. All `.pre-rotation.py.bak` files and the Downloads copy of the key JSON deleted. Stray GCP project `shos-490916` shut down. No plaintext key material remains on disk.
- **Git safety:** `.gitignore` in `SHOS\Finance\Document Signing\` covers `.env` and `*.pre-rotation.py.bak`. Safe to commit other files in that folder.

---

## 13. Working Style Cues

- **"yes" means execute all items** — not "noted, proceed when ready"
- Parallel over serial whenever possible
- Terse reports. Scannable. Tables and bullets over prose.
- No em dashes in emails (AI tell). Write human.
- No auto-send on any external email. Draft → Joseph reviews → Joseph sends.
- No generic recurring calendar blocks ("strategy time", "thinking block"). Real tasks from the scored backlog only.
- Every session should end with a closeout: calendar event updated from planned → completed, with time tracking.
- Supabase is the write target. If you're about to write to Notion or Salesforce for new data, stop and check.
- **NEVER draft emails without walking through the thread with Joseph first.**
- **These are families of fallen service members. Zero tolerance for errors.**
- Distinguish drafts from sent emails — they are NOT the same thing.
- The app needs to be ONE system, not isolated pages. Context is never lost — that's the whole point of HonorBase.

---

## 14. Key File Locations

| File | Purpose |
|---|---|
| `C:\dev\CONSOLIDATION_MASTER_PLAN.md` | Root mirror of the active to-do list |
| `C:\dev\AI Projects\SHOS\shos-app\docs\CONSOLIDATION_MASTER_PLAN.md` | **Canonical versioned copy** — prefer this one |
| `C:\dev\honorbase-chat\docs\STREAM_ARCHITECTURE.md` | **Primary architecture doc** for stream/routing/friction/knowledge system — read before touching any lib/ files |
| `C:\dev\honorbase-drmf\MIGRATION_PLAN.md` | DRMF → Supabase migration steps |
| `C:\dev\notion-content-migration-plan.md` | Notion content → knowledge_files migration plan |
| `C:\dev\AI Projects\GYST\gyst-dashboard\supabase\migrations\000_baseline.sql` | GYST schema reference (tables now live in Project A) |
| `C:\dev\AI Projects\SHOS\Bracelet Design Files\` | All SVG bracelet designs, organized by SKU |

---

## 16. What Was Built on 2026-04-21

### Supabase Storage — Bracelet Designs
- Created bucket `bracelet-designs` (public) in Project A
- Uploaded 23 SVG files across 15 SKU folders to `bracelet-designs/{SKU}/{filename}.svg`
- 2 files skipped — Slack HTML redirect stubs (expired download links), not real SVGs:
  - `USAFA07-HELTON/USAFA07-HELTON-7.svg` — needs re-download from Ryan
  - `USMC-NAVAS/USMC-NAVAS-7.svg` — needs re-download from Ryan
- Total: 5.3 MB uploaded
- Public URL base: `https://esoogmdwzcarvlodwbue.supabase.co/storage/v1/object/public/bracelet-designs/`
- Upload script: `shos-app/scripts/upload-bracelet-designs-storage.mjs` (idempotent, upsert=true)

---

## 15. Open Items / Next Session Priorities

| Item | Priority | Notes |
|---|---|---|
| Download MMMM 2026 photos from Drive | High | 37 photos from Kristin Hughes. Drive API task froze — retry manually or via MCP |
| Send Terrie Lawrence draft | High | DON-2026-004 ready_to_laser. Joseph approves → sends → ship |
| Verify `pk_live` in Vercel | High | Website go-live blocker |
| Re-download USAFA07-HELTON-7 + USMC-NAVAS-7 SVGs | Medium | Slack links expired — get fresh files from Ryan and re-run upload script |
| Chase Ryan on FIRE-ALTMAN | Medium | Brief sent Apr 17. No delivery yet. |
| Chase Ryan on ARMY-GLOVER | Medium | Task posted Mar 30. No delivery. |
| TMF 100-unit Manion order | Medium | Pending Katie's approval on updated design |
| Seb contact form reply | Medium | Family loosely in contact, unanswered |
| DRMF data migration | Medium | JSON → `event_tasks`/`event_sponsors` in Supabase |
| Google auth for honorbase-chat org routes | Medium | In progress as of Apr 16 |
| OneDrive `AI Projects` rename | Low | Blocked on FileSyncHelper — pause OneDrive sync to unblock |
| USAA Mar-Apr 2026 CSV download | Low | GYST transaction gap |

---

*Last synced: 2026-04-21 (end of session)*

> This doc is a living mirror of cross-account memory. Update it whenever the consolidation moves forward — especially when the master plan changes, a Supabase decision lands, or a security flag is resolved. The canonical version should be committed to `shos-app/docs/` alongside the master plan.
