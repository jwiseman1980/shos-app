# Comms Knowledge File
**Role:** Communications
**Last Updated:** 2026-03-28
**Session Count:** 0

---

## Role Definition
Comms owns the Steel Hearts public voice. This includes daily social media engagement, weekly amplification, monthly content planning, anniversary memorial publishing, supporter message pipeline, email communications, and press/media relations. Every post, every caption, every email from Steel Hearts passes through this role.

---

## Current State (as of 2026-03-28)

*This file is uninitialized. Run a Comms session to populate live data.*

| Metric | Value |
|--------|-------|
| Facebook Followers | — |
| Instagram Followers | — |
| Avg. Weekly Reach | — |
| Posts This Month | — |
| Upcoming Anniversaries (30 days) | — |
| Supporter Messages Pending | — |

---

## Platforms

| Platform | Handle | Primary Use |
|----------|--------|-------------|
| Facebook | Steel Hearts | Primary community, longer posts |
| Instagram | @steelhearts | Visual, reels, stories |
| Email | Via Gmail | Supporter messages, family outreach |

### API Access
- Meta Graph API: Live (FB + IG access)
- Gmail: Live via service account
- **CRITICAL:** Never use browser automation for IG comments. API only. Browser sent garbled "??" to memorial posts.

---

## Content Pillars
1. **Memorial Posts** — hero anniversaries, new bracelet launches
2. **Mission Content** — Gold Star family stories, impact
3. **Product** — new designs, behind the scenes
4. **Community** — supporter engagement, milestone celebrations

---

## SOPs Referenced
- SOP-001: Daily social media engagement
- SOP-002: Weekly amplification
- SOP-003: Monthly content planning
- SOP-014: Anniversary post publishing
- SOP-015: Memorial post workflow

---

## Salesforce Schema Reference

### Key Objects
- **Heroes:** Memorial_Bracelet__c
- **Families:** Contact (with family role)
- **Anniversary Tracker:** Memorial_Bracelet__c.Upcoming_Memorial_Date__c

### Key Fields
| Concept | Object | Field |
|---------|--------|-------|
| Memorial date | Memorial_Bracelet__c | Memorial_Date__c |
| Upcoming anniversary | Memorial_Bracelet__c | Upcoming_Memorial_Date__c |
| Active listing | Memorial_Bracelet__c | Active_Listing__c |
| Social post created | Memorial_Bracelet__c | Social_Media_Post_Created__c |
| Bio page created | Memorial_Bracelet__c | Bio_Page_Created_in_Squarespace__c |

**CRITICAL:** Only Active_Listing__c = true heroes appear on the website. Never post about inactive memorials.

---

## Decision Log
| Date | Decision | Reasoning |
|------|----------|-----------|
| 2026-03-28 | Knowledge file initialized | Comms role agent setup — baseline to be populated in first live session |

---

## Session Log
| Date | Summary |
|------|---------|
| 2026-03-28 | File created as skeleton. No live SF data pulled yet. |
