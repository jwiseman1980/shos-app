import {
  queryDatabase,
  createPage,
  updatePage,
  getText,
  getSelect,
  getRelation,
} from "@/lib/notion";

// Notion Graphic Design Tracker database ID
const DESIGN_TRACKER_DB = "cd7dae01-9ee5-498e-bebe-cc1c9b1e802a";

/**
 * Map a raw Notion page to a flat design task object.
 */
function mapDesignTask(page) {
  const p = page.properties;
  return {
    id: page.id,
    heroName: getText(p["Hero Name"] || p["Name"]),
    rank: getText(p["Rank"] || p["Rank/Title"]),
    branch: getSelect(p["Branch"]),
    classYear: getText(p["Class Year"]),
    customText: getText(p["Custom Text"]),
    status: getSelect(p["Status"]),
    assignee: getText(p["Assignee"]),
    relatedOrders: getRelation(p["Related Order Queue Record"]),
    notes: getText(p["Notes"]),
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

/**
 * Get all design tasks.
 */
export async function getDesignTasks() {
  try {
    const pages = await queryDatabase(DESIGN_TRACKER_DB, {
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });
    return pages.map(mapDesignTask);
  } catch (err) {
    console.error("Failed to fetch design tasks from Notion:", err.message);
    return [];
  }
}

/**
 * Get active (non-complete) design tasks.
 */
export async function getActiveDesignTasks() {
  try {
    const pages = await queryDatabase(DESIGN_TRACKER_DB, {
      filter: {
        property: "Status",
        select: { does_not_equal: "Complete" },
      },
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });
    return pages.map(mapDesignTask);
  } catch (err) {
    console.error("Failed to fetch active design tasks:", err.message);
    return [];
  }
}

/**
 * Get design task stats.
 */
export async function getDesignStats() {
  const tasks = await getDesignTasks();
  const total = tasks.length;
  const statusCounts = {};

  for (const t of tasks) {
    const s = t.status || "Not Started";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }

  return {
    total,
    active: total - (statusCounts["Complete"] || 0),
    statusCounts,
  };
}

/**
 * Create a new design task from an order that needs a design.
 */
export async function createDesignTask({
  heroName,
  rank = "",
  branch = "",
  classYear = "",
  customText = "",
  notes = "",
  relatedOrderId = null,
}) {
  const properties = {
    "Hero Name": { title: [{ text: { content: heroName } }] },
    "Status": { select: { name: "Not Started" } },
  };

  if (rank) {
    properties["Rank"] = { rich_text: [{ text: { content: rank } }] };
  }
  if (branch) {
    properties["Branch"] = { select: { name: branch } };
  }
  if (classYear) {
    properties["Class Year"] = { rich_text: [{ text: { content: classYear } }] };
  }
  if (customText) {
    properties["Custom Text"] = { rich_text: [{ text: { content: customText } }] };
  }
  if (notes) {
    properties["Notes"] = { rich_text: [{ text: { content: notes } }] };
  }
  if (relatedOrderId) {
    properties["Related Order Queue Record"] = {
      relation: [{ id: relatedOrderId }],
    };
  }

  return createPage(DESIGN_TRACKER_DB, properties);
}

/**
 * Update a design task's status.
 */
export async function updateDesignStatus(pageId, newStatus) {
  return updatePage(pageId, {
    "Status": { select: { name: newStatus } },
  });
}
