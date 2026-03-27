/**
 * Salesforce Storage Adapter
 *
 * Persists SHOS knowledge files and friction log in Salesforce custom objects.
 * Objects required:
 *   - SHOS_Knowledge__c (Role__c, Content__c, Last_Updated__c, Session_Count__c)
 *   - SHOS_Friction__c  (Role__c, Type__c, Priority__c, Description__c, Status__c, Logged_Date__c)
 */

import { sfQuery, sfCreate, sfUpdate } from "@/lib/salesforce";

const ROLE_NAMES = {
  ed:     "Executive Director",
  cos:    "Chief of Staff",
  cfo:    "CFO",
  coo:    "COO",
  comms:  "Director of Communications",
  dev:    "Director of Development",
  family: "Director of Family Relations",
};

// ---------------------------------------------------------------------------
// Knowledge files
// ---------------------------------------------------------------------------

/**
 * Read a role's knowledge content from SHOS_Knowledge__c.
 * Returns a placeholder if no record exists yet.
 */
export async function readKnowledge(role) {
  if (process.env.SF_LIVE !== "true") {
    return `(Salesforce not connected — SF_LIVE is not true. Cannot read knowledge for role: ${role})`;
  }

  try {
    const records = await sfQuery(
      `SELECT Id, Content__c, Last_Updated__c, Session_Count__c
       FROM SHOS_Knowledge__c
       WHERE Role__c = '${role}'
       LIMIT 1`
    );

    if (records.length === 0) {
      return `(No knowledge file found for role: ${role}. This is a fresh role — no prior sessions recorded.)`;
    }

    return records[0].Content__c || "(Knowledge file exists but content is empty.)";
  } catch (e) {
    return `(Failed to read knowledge from Salesforce: ${e.message})`;
  }
}

/**
 * Write (upsert) a role's knowledge content to SHOS_Knowledge__c.
 * Creates the record if it doesn't exist, updates if it does.
 */
export async function writeKnowledge(role, content) {
  if (process.env.SF_LIVE !== "true") {
    return "Salesforce not connected — knowledge file not saved.";
  }

  try {
    const existing = await sfQuery(
      `SELECT Id, Session_Count__c FROM SHOS_Knowledge__c WHERE Role__c = '${role}' LIMIT 1`
    );

    const now = new Date().toISOString();
    const sessionCount = existing.length > 0
      ? (existing[0].Session_Count__c || 0) + 1
      : 1;

    if (existing.length > 0) {
      await sfUpdate("SHOS_Knowledge__c", existing[0].Id, {
        Content__c: content,
        Last_Updated__c: now,
        Session_Count__c: sessionCount,
      });
      return `Knowledge file updated for ${ROLE_NAMES[role] || role} (session ${sessionCount}).`;
    } else {
      await sfCreate("SHOS_Knowledge__c", {
        Name: `${ROLE_NAMES[role] || role} Knowledge`,
        Role__c: role,
        Content__c: content,
        Last_Updated__c: now,
        Session_Count__c: 1,
      });
      return `Knowledge file created for ${ROLE_NAMES[role] || role}.`;
    }
  } catch (e) {
    return `Failed to write knowledge to Salesforce: ${e.message}`;
  }
}

// ---------------------------------------------------------------------------
// Friction log
// ---------------------------------------------------------------------------

/**
 * Append a friction item to SHOS_Friction__c.
 */
export async function logFriction(role, type, priority, description) {
  if (process.env.SF_LIVE !== "true") {
    return "Salesforce not connected — friction not logged.";
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    await sfCreate("SHOS_Friction__c", {
      Name: `${role.toUpperCase()} ${type} ${today}`,
      Role__c: role,
      Type__c: type,
      Priority__c: priority,
      Description__c: description,
      Status__c: "open",
      Logged_Date__c: today,
    });
    return `Friction logged: [${priority}] ${type} — "${description}"`;
  } catch (e) {
    return `Failed to log friction to Salesforce: ${e.message}`;
  }
}

/**
 * Read friction items from SHOS_Friction__c.
 * @param {string|null} statusFilter — 'open', 'triaged', 'queued', 'done', or null for all
 */
export async function readFriction(statusFilter = null) {
  if (process.env.SF_LIVE !== "true") {
    return [];
  }

  try {
    const whereClause = statusFilter
      ? `WHERE Status__c = '${statusFilter}'`
      : `WHERE Status__c != 'done'`;

    const records = await sfQuery(
      `SELECT Id, Name, Role__c, Type__c, Priority__c, Description__c, Status__c, Logged_Date__c
       FROM SHOS_Friction__c
       ${whereClause}
       ORDER BY Logged_Date__c DESC
       LIMIT 100`
    );

    return records;
  } catch (e) {
    return [];
  }
}
