# Steel Hearts Operator — Context File

Last updated: 2026-03-30
Session count: 1

## Organization
- **Steel Hearts Foundation** — 501(c)(3) Gold Star family memorial bracelet nonprofit (EIN: 47-2511085)
- **Founder/ED:** Joseph Wiseman (USMA '08)
- **Team:** Chris Marti, Kristin Hughes, Bianca Baldwin, Sean Reeves, Alex Kim, Melanie Gness, Ryan Santana, Matt Schwartz, Crysta Gonzalez, Sara Curran
- **Heroes honored:** 420+ active listings
- **Supabase is primary DB.** Salesforce is nightly backup mirror.

## Architecture (Two Agents)
- **Operator** (this agent) — handles ALL operational domains via the SHOS app
- **Architect** (Claude Code) — handles code, infrastructure, API builds
- Legacy role names (ed, cos, cfo, coo, comms, dev, family) are task DOMAINS, not separate agents

## Current Priorities
1. April anniversary emails — 36 heroes. Chris assigning to himself and Crysta.
2. Monthly team meeting — Thursday April 2, 7:00 PM ET
3. Board governance policy adoption — April 2 meeting agenda
4. Website transition from Squarespace — DNS cutover plan ready, Stripe needs live keys

## Compliance Deadlines
- SC Charitable Solicitation renewal: May 15, 2026
- Board governance policy adoption: April 2, 2026
- 990-EZ filing: In progress with CPA Tracy Hutter
- Insurance gaps: Zero D&O, zero General Liability
- VA Foreign Corp Registration: Unknown status

## Recent Decisions
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-30 | Operator + Architect model | Single Operator handles all domains. Architect handles builds. |
| 2026-03-30 | Supabase is primary, SF is backup | All reads/writes go to Supabase. Nightly sync pushes to SF. |
| 2026-03-30 | D-variant SKUs sunset | Donations at checkout are now separate line items, not attached to SKU. |
| 2026-03-30 | Transactional email system built | Order confirmations, donation receipts, tribute acknowledgments, shipping notifications — all automated via Gmail API. |
| 2026-03-30 | Privacy policy page live | Required for Meta compliance and website go-live. |
| 2026-03-28 | Notion and Zapier deprecated | Direct API integrations in SHOS app replaced both. |

## Website Transition Status (steel-hearts-site)
- All 16 pages built and functional
- Stripe checkout + donation flow complete (test mode)
- 354 QR code redirects from Squarespace URLs mapped
- Transactional email system ready (needs Google service account env vars on Vercel)
- Privacy policy page live
- Vercel Analytics integrated
- **Blockers:** Stripe live keys, DNS cutover, Google service account env vars

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-30 | CTO session: website transition features (email system, donation rework, privacy policy, analytics), CLAUDE.md + Operator v3 created, stale references cleanup |
| 2026-03-29 | CTO session: streaming chat, Supabase migration, anniversary fixes, Haiku switch, consolidated to single Operator |
