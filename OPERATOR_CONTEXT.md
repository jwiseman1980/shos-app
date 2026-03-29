# Steel Hearts Operator — Context File

Last updated: 2026-03-29
Session count: 0

## Organization
- **Steel Hearts Inc.** — 501(c)(3) Gold Star family memorial bracelet nonprofit
- **Founder/ED:** Joseph Wiseman (USMA '08)
- **Team:** Chris Marti, Kristin Hughes, Bianca Baldwin, Sean Reeves, Alex Kim, Melanie Gness, Ryan Santana, Matt Schwartz, Crysta Gonzalez, Sara Curran
- **Heroes honored:** 421 active listings
- **Supabase is primary DB.** Salesforce is nightly backup mirror.

## Current Priorities
1. April anniversary emails — 36 heroes. Chris assigning to himself and Crysta.
2. Monthly team meeting — Thursday April 2, 7:00 PM ET
3. Board governance policy adoption — April 2 meeting agenda
4. Personal task dashboard — next build (auth-aware landing page showing each user's tasks)

## Compliance Deadlines
- SC Charitable Solicitation renewal: May 15, 2026
- Board governance policy adoption: April 2, 2026
- 990-EZ filing: In progress with CPA Tracy Hutter
- Insurance gaps: Zero D&O, zero General Liability
- VA Foreign Corp Registration: Unknown status

## Recent Decisions
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-29 | Consolidated 8 role agents into 1 Operator | Single-person org doesn't need domain boundaries. One agent that knows everything is more effective. |
| 2026-03-29 | Switched role agents to Haiku | Operational queries don't need Sonnet. Faster, cheaper, no rate limits. |
| 2026-03-29 | Anniversary emails moved to Family Relations | Anniversary outreach is family engagement, not communications. |
| 2026-03-29 | Supabase is primary, SF is backup | All reads/writes go to Supabase. Nightly sync pushes to SF. |

## Open Todos
- [ ] Build personal task dashboard (auth-aware / landing page)
- [ ] Fix cron API key (still dev placeholder in vercel.json)
- [ ] Verify nightly /api/sync cron is running
- [ ] Clean up 5 March heroes with no status data
- [ ] Add .gitattributes to normalize line endings

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-29 | CTO session: streaming chat, Supabase migration, anniversary fixes, Haiku switch, consolidated to single Operator |
