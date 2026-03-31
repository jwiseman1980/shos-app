# Steel Hearts Foundation — Operator Knowledge Base
> Last updated: 2026-03-30
> Upload this file to the Claude.ai Project to give all team members full operational context.

---

## What This Is

Steel Hearts Foundation is a 501(c)(3) nonprofit (EIN: 47-2511085) that honors fallen military service members through memorial bracelets, family remembrance, and charitable giving. Founded by Joseph Wiseman, USMA Class of 2008.

**Guiding principle:** Automation supports compassion. Automation never replaces compassion.

---

## The Team

| Name | Role | Email | Domains |
|------|------|-------|---------|
| Joseph Wiseman | Founder / Executive Director | joseph.wiseman@steel-hearts.org | All — family outreach, laser production, strategy |
| Chris Marti | Volunteer Coordinator | chris.marti@steel-hearts.org | Memorial Ops, Anniversary Emails |
| Kristin Hughes | Volunteer | kristin.hughes@steel-hearts.org | Shipping, Anniversary Emails |
| Bianca Baldwin | Volunteer | bianca.baldwin@steel-hearts.org | Anniversary Emails |
| Alex Kim | Volunteer | alex.kim@steel-hearts.org | Anniversary Emails |
| Crysta Gonzalez | Volunteer | crysta.gonzalez@steel-hearts.org | Anniversary Emails |
| Melanie Gness | Volunteer | melanie.gness@steel-hearts.org | Anniversary Emails |
| Sean Reeves | Volunteer | sean.reeves@steel-hearts.org | Anniversary Emails |
| Matt Schwartz | Volunteer | matthew.schwartz@steel-hearts.org | Anniversary Emails |
| Ryan Santana | Graphic Designer (contractor) | ryan.santana@steel-hearts.org | Design |
| Sara Curran | Bookkeeper (external) | sara.curran@outlook.com | Finance |
| Tracy @ Hutter CPA | CPA (external) | tracy@hutter-cpa.com | Tax filing |

---

## How The System Works

### Two AI Agents
- **Operator** (this Project / SHOS app chat) — research, draft, analyze, plan, advise, execute SOPs
- **Architect** (Claude Code) — builds and maintains the code, infrastructure, and integrations

### Key Systems
| System | Purpose |
|--------|---------|
| **SHOS App** (shos-app.vercel.app) | Internal ops dashboard — orders, designs, shipping, anniversaries, finance, email, chat |
| **Website** (steel-hearts.org) | Public face — memorial pages, store, checkout, donations |
| **Supabase** | Primary database — all reads and writes |
| **Salesforce** | Nightly backup mirror — NOT primary |
| **Google Workspace** | Gmail (email drafts), Calendar (task system), Drive (design files) |
| **Stripe** | Payments — bracelet purchases + donations |
| **ShipStation** | Shipping — label creation + tracking |
| **Meta Graph API** | Facebook + Instagram engagement metrics |
| **Slack** | Notifications — ops hub + personal DMs |

### Core Rules
- **Supabase is primary.** Salesforce is backup. If data conflicts, Supabase wins.
- **Calendar IS the task system.** Every task, idea, and plan gets a calendar slot. No unscheduled backlogs.
- **AI drafts, humans send.** Never auto-send any external communication.
- **Everything gets recorded.** If it's not logged, it didn't happen.
- **Only active_listing = true heroes appear on the website.** No exceptions.
- **Never use browser automation for Instagram.** API only.

---

## Bracelet Business Model

- **Retail price:** $35 (all sizes)
- **$10 from every sale** goes to the family's designated charity (must be US 501(c)(3))
- **Family bracelets are always FREE** (donated)
- **Referrer gets 1 free donated bracelet**
- **No new bracelets without family contact** (policy as of March 2026)
- **International heroes welcome** (first: LCpl George Hooley, British Army)

### SKU Format
`BRANCH-LASTNAME-SIZE` (e.g., `USMA95-ADAMOUSKI-7`)
- Sizes: `-6` (6 inch), `-7` (7 inch)

### Production Pipeline
`not_started` → `design_needed` → `ready_to_laser` → `in_production` → `ready_to_ship` → `shipped`

### Laser Production (xTool F2 Ultra)
- Standard engrave: Power 31%, Speed 2500, 2 passes, 300 lines/cm, 60 kHz
- Color engrave: 13 presets, speed 100-200 mm/s for full spectrum
- 3 slots per run, position 2 swaps between 7" and 6"

---

## SHOS App Pages

| Page | Purpose | Who Uses It |
|------|---------|-------------|
| Dashboard (`/`) | Priority queue, scoreboard, calendar, daily brief | Everyone |
| Orders (`/orders`) | Order board — Kanban by production status | Joseph, Kristin |
| Designs (`/designs`) | Design work queue | Ryan |
| Laser (`/laser`) | Laser engraving queue + settings | Joseph |
| Shipping (`/shipping`) | Shipping queue | Kristin |
| Pipeline (`/bracelets`) | Full bracelet pipeline tracker | Joseph |
| Families (`/families`) | Family contact management | Joseph |
| Messages (`/messages`) | Supporter tribute messages | Joseph |
| Anniversaries (`/anniversaries`) | Anniversary tracker + email assignments | Chris, all volunteers |
| Donors (`/donors`) | Donor list + stewardship | Joseph |
| Finance (`/finance/*`) | Full finance suite | Joseph, Sara |
| Email (`/email`) | Gmail inbox + composer | Joseph |
| Social (`/comms/social`) | Social media dashboard | Joseph |
| Tasks (`/tasks`) | Task board | Everyone |
| SOPs (`/sops`) | SOP runner with checklists | Everyone |
| Volunteers (`/volunteers`) | Team roster | Joseph, Chris |
| Chat History (`/chat-history`) | Browse past Operator conversations | Everyone |

---

## What You Can Do As A Volunteer

### Always (no permission needed)
- Draft anniversary emails via the SHOS app Anniversaries page
- Review and personalize draft emails before sending from your @steel-hearts.org Gmail
- Update your assignment status in the tracker
- Add notes to heroes in the anniversary tracker
- Ask the Operator questions about processes, heroes, or your tasks
- Run SOPs step by step with the Operator's guidance

### Ask Joseph First
- Contact families directly
- Create new hero records
- Make financial decisions
- Change processes or SOPs
- Send any communication outside the team

---

## Anniversary Email Process (Most Common Volunteer Task)

### Your Workflow (SOP-ANN-002)
1. Open the SHOS app → Anniversaries page
2. Filter to your name to see your assignments
3. For each hero assigned to you:
   - Click "Create Draft" — this creates a draft in YOUR Gmail
   - Open Gmail → Drafts
   - Review the email — check names, dates, make it personal
   - Send it (or schedule for 9 AM ET on the anniversary date)
   - Update the status in the tracker to "Sent"
4. Repeat for all your assignments

### Email Tone Guidelines
- **Use "Dear"** — respectful, not casual
- **Full rank + name on first mention only** — then first name
- **Never mention bracelets** — this isn't marketing
- **Never reference the family's "willingness"** — don't frame it as them doing us a favor
- **Be sincere and heartfelt** — these go to Gold Star families on one of the hardest days of the year
- **Close with "With love and respect"**
- **Add visible spacing between paragraphs**

### The Draft Template
The Operator generates drafts that look like this:

> Dear [Family Name],
>
> I wanted to reach out today because [First Name] has been on my mind. The [Xth] anniversary of [Full Name]'s passing is a day we hold close here at Steel Hearts, and I wanted you to know that your family is in our thoughts and prayers.
>
> [First Name] is not forgotten — not today, and not any day. It is a genuine honor to help keep [First Name]'s memory alive, and we are grateful to be a small part of that.
>
> Please don't hesitate to reach out if there's ever anything we can do, or if you just want to talk. We're here.
>
> With love and respect,
> [Your Name]
> [Your Signature]

**You can and should personalize this.** The draft is a starting point. If you know something about the family or hero, add it. Make it yours.

---

## Active SOPs

### Daily
- **SOP-001:** Daily Social Media Engagement — 15-20 min: Meta inbox, comments, growth levers, story sharing

### Weekly
- **SOP-DON-002:** Donor Stewardship — review new donations, compose personalized thank-you emails
- **SOP-INV-001:** Order Fulfillment — triage orders, laser production, shipping

### Monthly
- **SOP-ANN-001:** Anniversary Remembrance — full cycle: assign volunteers, draft emails, checkpoint, close
- **SOP-003:** Monthly Content Planning — plan and schedule memorial posts
- **SOP-015:** Social Media Performance Review — export KPIs, analyze trends
- **SOP-FIN-001:** Monthly Financial Operations — classify orders, calculate donations, execute payments
- **SOP-FIN-002:** Monthly Financial Close — Sara posts journal entries, reconciles, generates reports
- **FM-OPS-002:** Supporter Message Delivery — package and deliver tribute messages to families

### As Needed
- **SOP-002:** Anniversary Memorial Post Publishing — create and publish memorial posts
- **SOP-004:** Memorial Commission Intake — process new bracelet requests
- **SOP-DON-001:** Donated Bracelet Intake — process donated bracelet requests

---

## Partner Organizations

### Tier 1 — Strategic Partners
- Memorial Valor Foundation
- Legacies Alive

### Tier 2 — Active Partners
- Travis Manion Foundation
- Brotallion Blue Skies
- Wind River Ranch

### Tier 3 — Passive (170+ orgs)
Organizations receiving $10/bracelet disbursements based on family charity designations.

---

## Upcoming Events (2026)

| Event | Date | Details |
|-------|------|---------|
| Legacies Alive MMMM | April 2026 | 300 donated bracelets |
| Monthly Team Meeting | April 2, 2026 | Thursday 7:00 PM ET |
| Tom Surdyke Golf Tournament | May 29, 2026 | Donation outreach needed |
| Drew Ross Memorial Ruck | June 2026 | ~200 bracelets |
| Memorial Valor M3G | October 2026 | SH attending |

---

## Current Intake Pipeline

| Hero | SKU | Status | Contact |
|------|-----|--------|---------|
| Maj. Moises A. Navas | USMC-NAVAS | Intake | Mo (brother) |
| LCpl George Hooley | BA-HOOLEY | Intake | Seb (referrer) |
| Maj. John "Alex" Klinner | USAF-KLINNER | Intake | Savannah (IG) |
| ZEUS 95 Crew Memorial | USAF-ZEUS95 | Intake | Savannah (IG) |
| MAFFS 7 (4 crew) | TBD | Radar | Chrislo Whitcomb |

---

## Compliance & Governance

- **SC Charitable Solicitation renewal:** May 15, 2026
- **Board governance policy adoption:** In progress
- **990-EZ filing:** In progress with CPA Tracy Hutter
- **Insurance gaps:** Zero D&O, zero General Liability (flagged)
- **VA Foreign Corp Registration:** Unknown status (flagged)

---

## Key Policies

- Family bracelets are always FREE (donated)
- Referrer gets 1 donated bracelet
- Charity must be US-based 501(c)(3) — legal requirement
- No new bracelets without family contact (policy March 2026)
- $10 from every bracelet sale goes to family's designated charity
- Research Queue — 124 legacy heroes missing family contacts, resolve by EOY 2026
- AI drafts, humans send — never auto-send external communications
- Joseph handles all family communication directly
- Financial contacts (Tracy, Sara) — flag only, never auto-respond

---

## If You're New

1. You have a @steel-hearts.org email — use it for all Steel Hearts work
2. The SHOS app is at shos-app.vercel.app — log in with the password Joseph gave you
3. Your main job is probably anniversary emails — Chris will assign heroes to you each month
4. The Operator (this AI) can help you with anything — just ask
5. When in doubt, ask Joseph. When in doubt about a process, say so — never guess
6. Everything you do gets recorded. That's not surveillance — it's how we make sure nothing falls through the cracks for these families
