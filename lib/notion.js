import { Client } from "@notionhq/client";

let _client = null;

/**
 * Get or create a Notion client instance.
 * Requires NOTION_API_KEY env var.
 */
export function getNotionClient() {
  if (_client) return _client;
  const token = process.env.NOTION_API_KEY;
  if (!token) {
    throw new Error("NOTION_API_KEY not configured");
  }
  _client = new Client({ auth: token });
  return _client;
}

/**
 * Query a Notion database with optional filter and sorts.
 * Returns raw Notion page objects.
 */
export async function queryDatabase(databaseId, { filter, sorts, pageSize = 100 } = {}) {
  const notion = getNotionClient();
  const pages = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter,
      sorts,
      page_size: pageSize,
      start_cursor: cursor,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return pages;
}

/**
 * Create a page in a Notion database.
 */
export async function createPage(databaseId, properties) {
  const notion = getNotionClient();
  return notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });
}

/**
 * Update a Notion page's properties.
 */
export async function updatePage(pageId, properties) {
  const notion = getNotionClient();
  return notion.pages.update({
    page_id: pageId,
    properties,
  });
}

// ---------------------------------------------------------------------------
// Notion property extractors — helpers to pull typed values from Notion props
// ---------------------------------------------------------------------------

export function getText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return prop.title?.map((t) => t.plain_text).join("") || "";
  if (prop.type === "rich_text") return prop.rich_text?.map((t) => t.plain_text).join("") || "";
  return "";
}

export function getSelect(prop) {
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name || null;
}

export function getMultiSelect(prop) {
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select?.map((s) => s.name) || [];
}

export function getNumber(prop) {
  if (!prop || prop.type !== "number") return 0;
  return prop.number || 0;
}

export function getDate(prop) {
  if (!prop || prop.type !== "date") return null;
  return prop.date?.start || null;
}

export function getCheckbox(prop) {
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox || false;
}

export function getUrl(prop) {
  if (!prop || prop.type !== "url") return null;
  return prop.url || null;
}

export function getEmail(prop) {
  if (!prop || prop.type !== "email") return null;
  return prop.email || null;
}

export function getRelation(prop) {
  if (!prop || prop.type !== "relation") return [];
  return prop.relation?.map((r) => r.id) || [];
}
