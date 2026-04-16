# CONSOLIDATION MASTER PLAN

Joseph's single source of truth across sessions and across both Claude accounts.
This document tracks the state of the Steel-Hearts / SHOS / HonorBase / DRMF / GYST ecosystem, what's been consolidated, what's queued, and what's blocked waiting on access or a decision.

---

## 1. State of Play (Apr 16, 2026)

The big picture across the four product lines:

| Line | What it is | Where the code lives | Where the data lives | Status |
|---|---|---|---|---|
| **Steel-Hearts / SHOS** | Org-level app (events, sponsors, tasks, properties) | `shos-app` (inside `C:\dev\AI Projects\`) | Supabase **Project A** (`event_tasks`, `event_sponsors`, 3-property `properties` dataset) | Alive, canonical |
| **HonorBase – Chat** | Next.js chat/agent surface that reads knowledge | `C:\dev\honorbase-chat` | Supabase **Project A** (`execution_log`, `context_log`, pending `system_config`, `knowledge_files`) | Alive, mostly wired |
| **HonorBase – DRMF** | Data-room / metrics / brief API | `C:\dev\honorbase-drmf` | SQLite (legacy JSON) → being migrated to Supabase **Project A** | Mid-migration |
| **GYST** | Property-management dashboard | `C:\dev\AI Projects\GYST\gyst-dashboard` | Supabase **Project B** (`esoogmdwzcarvlodwbue`) | **Project B is DEAD** — needs rebuild or fold-in |

Everything is converging on Supabase Project A as the single backend, with GYST as the open question.

---

## 2. Supabase Projects

### Project A — alive and canonical

- Owns: `event_tasks`, `event_sponsors`, `properties` (3-property dataset: 530 Palmarosa, 4240 Vallonia, 111 Schoolfield), `execution_log`, `context_log`, `knowledge_files`.
- Consumers: `shos-app`, `honorbase-chat`, `honorbase-drmf` (after migration).
- Confirmed this session: `execution_log` and `context_log` **do** exist. `system_config` **does not** exist and is the actual missing piece — migration `002_system_config.sql` has been written but not yet applied.
- **Silent-failure risk:** honorbase-chat code references `system_config` in config-lookup paths. If queries run before the migration is applied, they degrade silently (empty config / default fallback) rather than throwing. Apply `002_system_config.sql` before the next deploy.

### Project B — `esoogmdwzcarvlodwbue` — DEAD

- Consumer: `gyst-dashboard` only.
- Discovered this session: the project is non-responsive. Not just empty — the project itself is dead.
- Blocking decision required (see §6).
- `gyst-dashboard/supabase/migrations/000_baseline.sql` was reconstructed from code inference this session so whichever path is chosen (rebuild B, or fold into A), the schema is captured.

### Silent-failure risks to watch

- `system_config` lookups in honorbase-chat returning empty → chat operates on defaults.
- Any `gyst-dashboard` code still pointed at Project B → writes vanish, reads return nothing.
- DRMF JSON → Supabase migration is partial; anything still reading from local SQLite while the API writes to Supabase will diverge.

---

## 3. Active Code Repos

| Repo | Location | Branch / worktree notes | Uncommitted work |
|---|---|---|---|
| **honorbase-chat** | `C:\dev\honorbase-chat` | Main worktree only; 3 redundant worktrees (`sad-satoshi`, `awesome-yalow`, `recursing-wu`) **pruned this session** | `002_system_config.sql` staged for manual apply |
| **honorbase-drmf** | `C:\dev\honorbase-drmf` | Active | 2 uncommitted edits: `app/api/brief/route.ts`, `app/api/metrics/route.ts`. Also has `supabase/migrations/000_baseline_from_sqlite.sql` + `MIGRATION_PLAN.md` newly written |
| **gyst-dashboard** | `C:\dev\AI Projects\GYST\gyst-dashboard` | Active | `supabase/migrations/000_baseline.sql` newly written (from code inference); Supabase backend is dead — repo is pointed at a zombie |
| **shos-app** | `C:\dev\AI Projects\shos-app` | Active | No new uncommitted work noted this session |

Note: `shos-app` and `gyst-dashboard` both live **inside `AI Projects`** (with the space), which interacts with the scatter problem below.

---

## 4. The Scatter

Work is spread across four roots that shouldn't all exist:

| Location | What's there | Problem |
|---|---|---|
| `C:\dev` (root) | 4 loose Python scripts, a stray `null` file, a JSON file saved to a Windows-temp-path-as-filename | Should not have loose files; everything should live under a project folder |
| `C:\dev\AI Projects\` (with space) | Canonical: `shos-app`, `GYST/gyst-dashboard`, active project work | Path with space is friction for shell/tooling, but this is the live copy |
| `C:\dev\AI-Projects\` (no space, hyphen) | A parallel folder — overlaps with `AI Projects\` but drifted | 6 files are **newer** in this hyphen-version than in the space-version. Source of stale-version risk. |
| OneDrive `AI Projects` | Pre-sync-break copy | **OneDrive sync broke ~Apr 6, 2026.** Anything edited locally since then is not reflected on OneDrive; anything edited on OneDrive since then is not reflected locally. Also contains junk: empty crash dirs, stray Godot EXEs, broken-filename JSON, superseded versioned prompt files. |

Canonical direction: `C:\dev\AI Projects\` (with space) is the live copy. `AI-Projects\` (hyphen) needs to be reconciled into it, OneDrive junk purged, and the OneDrive sync either repaired or abandoned.

---

## 5. Consolidation Steps — Completed This Session

- Pruned 3 redundant honorbase-chat worktrees: `sad-satoshi`, `awesome-yalow`, `recursing-wu`.
- Full inventory of everything across `C:\dev` and OneDrive `AI Projects`.
- Diffed `C:\dev\AI Projects\` vs `C:\dev\AI-Projects\` — 6 files newer in the hyphen version.
- Introspected both Supabase projects; confirmed Project A alive with `execution_log` and `context_log` present.
- Identified `system_config` as the actual missing table (not `execution_log` / `context_log` as previously suspected).
- Wrote `C:\dev\honorbase-chat\supabase\migrations\002_system_config.sql` — needs manual apply.
- Wrote `C:\dev\AI Projects\GYST\gyst-dashboard\supabase\migrations\000_baseline.sql` from code inference.
- Wrote `C:\dev\honorbase-drmf\supabase\migrations\000_baseline_from_sqlite.sql` and `MIGRATION_PLAN.md`.
- Wrote `C:\dev\notion-content-migration-plan.md`.
- Discovered GYST Supabase Project B is dead.

---

## 6. Consolidation Steps — Queued / Pending

Owner key: **J** = Joseph, **C** = Claude (any session).

### Decisions Joseph owns

- [ ] **[J]** Apply `002_system_config.sql` via the Supabase SQL editor — or hand over the DB password / a PAT so Claude can apply it.
- [ ] **[J]** **Decide:** rebuild the dead GYST Supabase Project B, OR fold `gyst-dashboard` into Project A (aligns with everything else).
- [ ] **[J]** **Decide:** DRMF `tasks` and `sponsors` — merge into SHOS `event_tasks` / `event_sponsors`, or keep namespaced as `drmf_tasks` / `drmf_sponsors`?
- [ ] **[J]** Locate or re-export the missing Notion `SOPs/` and `Finance/` content so the Notion content migration can proceed.

### Execution Claude owns (queued)

- [ ] **[C]** AI Projects reconciliation: copy 6 newer files from `AI-Projects\` (hyphen) → `AI Projects\` (space), sync back the other direction where space-version is newer, then purge OneDrive junk. (Queued as a separate task.)
- [ ] **[C]** `C:\dev` root cleanup: home the 4 loose Python scripts inside their proper projects, remove the stray `null` file and the misplaced Windows-temp-path-as-filename JSON. (Queued as a separate task.)
- [ ] **[C]** Commit the 2 uncommitted honorbase-drmf API-route edits (`app/api/brief/route.ts`, `app/api/metrics/route.ts`) after Joseph reviews.
- [ ] **[C]** Once DRMF decision lands, execute the DRMF JSON → Supabase migration per `MIGRATION_PLAN.md`.
- [ ] **[C]** Once Notion SOPs/Finance content exists, execute the Notion content migration into `knowledge_files` + Git `/knowledge/` per `notion-content-migration-plan.md`.
- [ ] **[C]** Once GYST Supabase decision lands, execute the fold-in (or the rebuild).
- [ ] **[C]** Remove unused `better-sqlite3` and `uuid` packages from honorbase-drmf after migration.
- [ ] **[C]** After gyst-dashboard is repointed, migrate its `properties` dataset into Project A's `gyst_properties` — **merging with shos-app's 3-property dataset (530 Palmarosa, 4240 Vallonia, 111 Schoolfield)** which is already the live canonical copy.

---

## 7. Access / Credentials Needed from Joseph

To accelerate execution, Claude needs (any one of each group is sufficient):

**Supabase Project A — pick any one**
- DB password for project `esoogmdwzcarvlodwbue`, OR
- A Supabase personal access token (PAT) for the Management API, OR
- Permission to link the Supabase CLI from a code session (`supabase login` + `supabase link --project-ref …`).

**Decisions blocking execution**
- Project B: rebuild or fold-in?
- DRMF table merge strategy: shared tables or `drmf_*` namespace?

**Notion content migration**
- Notion API token if automated re-export of SOPs + Finance content is preferred. Otherwise Joseph exports manually.

**Housekeeping approvals**
- Approval to delete OneDrive-side junk: empty crash dirs, stray Godot EXEs, broken-filename JSON files, superseded versioned prompt files.

---

## 8. Open Questions / Unresolved

- Is Supabase Project B (`esoogmdwzcarvlodwbue`) recoverable at all, or is a rebuild the only path?
- Are any of the 4 loose Python scripts in `C:\dev` still in use by any running job or scheduled task before they get homed?
- Has the OneDrive sync break (~Apr 6) caused any silent data loss on files that were only ever edited on OneDrive since that date?
- Does DRMF have any external consumers (dashboards, emails, other apps) that pin specific table names and would break under an `event_tasks` merge?
- Are there other Notion sections beyond `SOPs/` and `Finance/` that should migrate into `knowledge_files` at the same time?
- Is the `properties` dataset in `gyst-dashboard` newer than shos-app's 3-property canonical set, or is shos-app definitively ahead?

---

Last updated: 2026-04-16
