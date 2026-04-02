/**
 * Meta Graph API Client
 *
 * Provides read access to Steel Hearts Facebook Page and Instagram account.
 * Uses long-lived Page Access Token for both FB and IG APIs.
 *
 * Capabilities:
 * - Read page/profile info
 * - List recent posts with engagement metrics
 * - Read comments on posts
 * - Reply to comments (drafts human review)
 * - Get aggregate insights (reach, impressions, engagement)
 *
 * Token refresh: Page tokens last ~60 days. Refresh via:
 *   GET /oauth/access_token?grant_type=fb_exchange_token&
 *       client_id={app_id}&client_secret={app_secret}&
 *       fb_exchange_token={short_lived_token}
 */

const GRAPH_URL = "https://graph.facebook.com/v21.0";

function getConfig() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID || "960309493995353";
  const igUserId = process.env.IG_USER_ID || "17841402809228712";

  if (!token) {
    throw new Error("META_PAGE_ACCESS_TOKEN not configured");
  }

  return { token, pageId, igUserId };
}

async function graphGet(path, params = {}) {
  const { token } = getConfig();
  const url = new URL(`${GRAPH_URL}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Graph API ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Facebook Page
// ---------------------------------------------------------------------------

/**
 * Get recent Facebook posts with engagement metrics.
 * @param {number} limit — Number of posts (default 10, max 100)
 */
export async function getFacebookPosts(limit = 10) {
  const { pageId } = getConfig();
  const data = await graphGet(`/${pageId}/posts`, {
    fields: "id,message,created_time,permalink_url,shares,likes.summary(true),comments.summary(true),attachments{media_type,url,media}",
    limit: String(limit),
  });
  return (data.data || []).map((post) => ({
    id: post.id,
    message: post.message?.slice(0, 300),
    createdAt: post.created_time,
    permalink: post.permalink_url,
    likes: post.likes?.summary?.total_count || 0,
    comments: post.comments?.summary?.total_count || 0,
    shares: post.shares?.count || 0,
    mediaType: post.attachments?.data?.[0]?.media_type || "status",
  }));
}

/**
 * Get page-level insights for a date range.
 * @param {string} metric — e.g. "page_impressions,page_engaged_users,page_fans"
 * @param {string} period — "day", "week", "days_28"
 */
export async function getFacebookInsights(metric = "page_impressions,page_engaged_users,page_post_engagements", period = "day") {
  const { pageId } = getConfig();
  const data = await graphGet(`/${pageId}/insights`, {
    metric,
    period,
  });
  const result = {};
  for (const m of data.data || []) {
    const latest = m.values?.[m.values.length - 1];
    result[m.name] = {
      title: m.title,
      value: latest?.value || 0,
      period: m.period,
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Instagram
// ---------------------------------------------------------------------------

/**
 * Get recent Instagram media with engagement metrics.
 * @param {number} limit — Number of posts (default 10)
 */
export async function getInstagramPosts(limit = 10) {
  const { igUserId } = getConfig();
  const data = await graphGet(`/${igUserId}/media`, {
    fields: "id,caption,timestamp,permalink,media_type,like_count,comments_count,thumbnail_url,media_url",
    limit: String(limit),
  });
  return (data.data || []).map((post) => ({
    id: post.id,
    caption: post.caption?.slice(0, 300),
    createdAt: post.timestamp,
    permalink: post.permalink,
    mediaType: post.media_type,
    likes: post.like_count || 0,
    comments: post.comments_count || 0,
    thumbnailUrl: post.thumbnail_url || post.media_url,
  }));
}

/**
 * Get Facebook Page profile stats.
 */
export async function getFacebookProfile() {
  const { pageId } = getConfig();
  const data = await graphGet(`/${pageId}`, {
    fields: "id,name,followers_count,fan_count",
  });
  return {
    username: data.name || "SteelHeartsFoundation",
    name: data.name,
    followers: data.followers_count || data.fan_count || 0,
    following: 0,
    posts: 0, // FB page API does not expose post count directly
  };
}

/**
 * Get Instagram profile stats.
 */
export async function getInstagramProfile() {
  const { igUserId } = getConfig();
  const data = await graphGet(`/${igUserId}`, {
    fields: "id,username,name,biography,followers_count,follows_count,media_count",
  });
  return {
    username: data.username,
    name: data.name,
    bio: data.biography,
    followers: data.followers_count || 0,
    following: data.follows_count || 0,
    posts: data.media_count || 0,
  };
}

/**
 * Get comments on a specific post (FB or IG).
 * @param {string} postId — The post ID
 * @param {number} limit — Number of comments
 */
export async function getPostComments(postId, limit = 25) {
  const data = await graphGet(`/${postId}/comments`, {
    fields: "id,text,message,from{name,id},timestamp,like_count",
    limit: String(limit),
  });
  return (data.data || []).map((c) => ({
    id: c.id,
    text: c.text || c.message,
    from: c.from?.name || "Unknown",
    fromId: c.from?.id,
    timestamp: c.timestamp,
    likes: c.like_count || 0,
  }));
}

/**
 * Reply to a comment (FB page comment).
 * IMPORTANT: Human must review before sending in production.
 * @param {string} commentId — The comment to reply to
 * @param {string} message — The reply text
 */
export async function replyToComment(commentId, message) {
  const { token } = getConfig();
  const res = await fetch(`${GRAPH_URL}/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      access_token: token,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Reply failed: ${res.status}`);
  }

  return res.json();
}

/**
 * Check if the Meta token is still valid and when it expires.
 */
export async function checkTokenHealth() {
  const { token } = getConfig();
  try {
    const data = await graphGet("/debug_token", {
      input_token: token,
    });
    const info = data.data || {};
    return {
      valid: info.is_valid,
      expiresAt: info.expires_at ? new Date(info.expires_at * 1000).toISOString() : "never",
      scopes: info.scopes || [],
      type: info.type,
    };
  } catch {
    return { valid: false, error: "Token check failed" };
  }
}
