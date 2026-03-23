import { sfQuery } from "@/lib/salesforce";

const SF_LIVE = process.env.SF_LIVE === "true";

/**
 * Get all heroes with active design tasks (Queued, In Progress, Submitted)
 */
export async function getDesignQueue() {
  if (!SF_LIVE) return [];

  try {
    const records = await sfQuery(
      `SELECT Id, Name, Rank__c, Lineitem_sku__c, Memorial_Date__c,
              Design_Status__c, Design_Priority__c, Design_Brief__c, Design_Due_Date__c,
              Bracelet_Design_Created__c, Has_Graphic_Design__c,
              Pipeline_Stage__c, Active_Listing__c, Incident__c,
              Service_Academy_or_Branch__c, CreatedDate
       FROM Memorial_Bracelet__c
       WHERE Design_Status__c IN ('Queued', 'In Progress', 'Submitted')
       ORDER BY CreatedDate DESC`
    );

    return records.map(mapRecord);
  } catch (err) {
    console.error("Design queue load error:", err.message);
    return [];
  }
}

/**
 * Get heroes that NEED design but haven't been queued yet
 */
export async function getNeedsDesign() {
  if (!SF_LIVE) return [];

  try {
    const records = await sfQuery(
      `SELECT Id, Name, Rank__c, Lineitem_sku__c,
              Design_Status__c, Pipeline_Stage__c, Incident__c,
              Service_Academy_or_Branch__c, CreatedDate
       FROM Memorial_Bracelet__c
       WHERE Bracelet_Design_Created__c = false
         AND Has_Graphic_Design__c = false
         AND Active_Listing__c = false
         AND (Design_Status__c = 'Not requested' OR Design_Status__c = null)
       ORDER BY CreatedDate DESC
       LIMIT 50`
    );

    return records.map(mapRecord);
  } catch (err) {
    console.error("Needs design load error:", err.message);
    return [];
  }
}

/**
 * Get design stats
 */
export async function getDesignStats() {
  if (!SF_LIVE) {
    return { queued: 0, inProgress: 0, submitted: 0, needsDesign: 0, complete: 0 };
  }

  try {
    const [queued, inProgress, submitted, complete, needsDesign] = await Promise.all([
      sfQuery("SELECT COUNT(Id) total FROM Memorial_Bracelet__c WHERE Design_Status__c = 'Queued'"),
      sfQuery("SELECT COUNT(Id) total FROM Memorial_Bracelet__c WHERE Design_Status__c = 'In Progress'"),
      sfQuery("SELECT COUNT(Id) total FROM Memorial_Bracelet__c WHERE Design_Status__c = 'Submitted'"),
      sfQuery("SELECT COUNT(Id) total FROM Memorial_Bracelet__c WHERE Design_Status__c = 'Complete'"),
      sfQuery(
        `SELECT COUNT(Id) total FROM Memorial_Bracelet__c
         WHERE Bracelet_Design_Created__c = false
           AND Has_Graphic_Design__c = false
           AND Active_Listing__c = false
           AND (Design_Status__c = 'Not requested' OR Design_Status__c = null)`
      ),
    ]);

    return {
      queued: queued[0]?.total || 0,
      inProgress: inProgress[0]?.total || 0,
      submitted: submitted[0]?.total || 0,
      complete: complete[0]?.total || 0,
      needsDesign: needsDesign[0]?.total || 0,
    };
  } catch (err) {
    console.error("Design stats error:", err.message);
    return { queued: 0, inProgress: 0, submitted: 0, needsDesign: 0, complete: 0 };
  }
}

function mapRecord(r) {
  return {
    id: r.Id,
    name: r.Name,
    rank: r.Rank__c || "",
    sku: r.Lineitem_sku__c || "",
    branch: r.Service_Academy_or_Branch__c || "",
    memorialDate: r.Memorial_Date__c,
    designStatus: r.Design_Status__c || "Not requested",
    designPriority: r.Design_Priority__c || "Normal",
    designBrief: r.Design_Brief__c || "",
    designDueDate: r.Design_Due_Date__c,
    hasDesign: r.Bracelet_Design_Created__c || r.Has_Graphic_Design__c || false,
    pipelineStage: r.Pipeline_Stage__c || "",
    activeListing: r.Active_Listing__c || false,
    incident: r.Incident__c || "",
    createdDate: r.CreatedDate,
  };
}
