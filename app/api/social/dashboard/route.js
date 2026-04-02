/**
 * Social Media Dashboard API
 *
 * Aggregates live Meta Graph API data + Supabase historical data
 * for the Social Media Dashboard page.
 *
 * Returns:
 * - Current IG/FB follower counts (live from Meta)
 * - 30-day follower growth history (Meta Insights API)
 * - Recent posts with engagement (Supabase social_media_posts)
 * - Top performing posts by engagement
 */

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

function getMetaConfig() {
  const token = process.env.META_PAGE_ACCESS_TOKEN;
  const pageId = process.env.META_PAGE_ID || "960309493995353";
  const igUserId = process.env.IG_USER_ID || "17841402809228712";
  if (!token) throw new Error("META_PAGE_ACCESS_TOKEN not configured");
  return { token, pageId, igUserId };
}

async function metaGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Graph API ${res.status}`);
  }
  return res.json();
}

export async function GET() {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, pageId, igUserId } = getMetaConfig();
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60;

  // Fetch all data in parallel
  const [
    igProfile,
    fbPage,
    igFollowerInsights,
    fbFollowerInsights,
    recentPosts,
    topPosts,
    profileSnapshots,
  ] = await Promise.allSettled([
    // Live IG profile
    metaGet(
      `${GRAPH_URL}/${igUserId}?fields=followers_count,follows_count,media_count&access_token=${token}`
    ),
    // Live FB page followers
    metaGet(
      `${GRAPH_URL}/${pageId}?fields=followers_count&access_token=${token}`
    ),
    // IG follower daily changes (30 days)
    metaGet(
      `${GRAPH_URL}/${igUserId}/insights?metric=follower_count&period=day&since=${thirtyDaysAgo}&until=${now}&access_token=${token}`
    ),
    // FB page daily follows (30 days)
    metaGet(
      `${GRAPH_URL}/${pageId}/insights?metric=page_daily_follows&period=day&since=${thirtyDaysAgo}&until=${now}&access_token=${token}`
    ),
    // Recent posts from Supabase
    fetchRecentPosts(),
    // Top posts from Supabase
    fetchTopPosts(),
    // Historical snapshots from Supabase
    fetchProfileSnapshots(),
  ]);

  // Extract results (use null for failures)
  const igData = igProfile.status === "fulfilled" ? igProfile.value : null;
  const fbData = fbPage.status === "fulfilled" ? fbPage.value : null;
  const igInsights =
    igFollowerInsights.status === "fulfilled"
      ? igFollowerInsights.value
      : null;
  const fbInsights =
    fbFollowerInsights.status === "fulfilled"
      ? fbFollowerInsights.value
      : null;
  const posts = recentPosts.status === "fulfilled" ? recentPosts.value : [];
  const top = topPosts.status === "fulfilled" ? topPosts.value : [];
  const snapshots =
    profileSnapshots.status === "fulfilled" ? profileSnapshots.value : [];

  // Parse follower growth data
  const igGrowth = parseInsightsTimeSeries(igInsights);
  const fbGrowth = parseInsightsTimeSeries(fbInsights);

  // Merge into daily growth timeline
  const growthTimeline = mergeGrowthTimelines(igGrowth, fbGrowth);

  // Compute 30-day net change
  const igNetChange = igGrowth.reduce((sum, d) => sum + d.value, 0);
  const fbNetChange = fbGrowth.reduce((sum, d) => sum + d.value, 0);

  return NextResponse.json({
    success: true,
    current: {
      igFollowers: igData?.followers_count || null,
      igFollowing: igData?.follows_count || null,
      igMediaCount: igData?.media_count || null,
      fbFollowers: fbData?.followers_count || null,
      combinedFollowers:
        (igData?.followers_count || 0) + (fbData?.followers_count || 0),
    },
    growth: {
      igNetChange30d: igNetChange,
      fbNetChange30d: fbNetChange,
      combinedNetChange30d: igNetChange + fbNetChange,
      timeline: growthTimeline,
    },
    recentPosts: posts,
    topPosts: top,
    profileSnapshots: snapshots,
    errors: {
      igProfile: igProfile.status === "rejected" ? igProfile.reason?.message : null,
      fbPage: fbPage.status === "rejected" ? fbPage.reason?.message : null,
      igInsights: igFollowerInsights.status === "rejected" ? igFollowerInsights.reason?.message : null,
      fbInsights: fbFollowerInsights.status === "rejected" ? fbFollowerInsights.reason?.message : null,
    },
  });
}

/**
 * Parse Meta Insights API response into [{date, value}] array.
 */
function parseInsightsTimeSeries(insightsData) {
  if (!insightsData?.data?.[0]?.values) return [];
  return insightsData.data[0].values.map((v) => ({
    date: v.end_time?.split("T")[0] || "",
    value: v.value || 0,
  }));
}

/**
 * Merge IG and FB daily growth into a single timeline.
 */
function mergeGrowthTimelines(igGrowth, fbGrowth) {
  const dateMap = {};

  for (const d of igGrowth) {
    if (!dateMap[d.date]) dateMap[d.date] = { date: d.date, ig: 0, fb: 0 };
    dateMap[d.date].ig = d.value;
  }
  for (const d of fbGrowth) {
    if (!dateMap[d.date]) dateMap[d.date] = { date: d.date, ig: 0, fb: 0 };
    dateMap[d.date].fb = d.value;
  }

  return Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ ...d, total: d.ig + d.fb }));
}

/**
 * Fetch recent posts from Supabase social_media_posts, ordered by posted_at desc.
 */
async function fetchRecentPosts() {
  const sb = getServerClient();
  const { data, error } = await sb
    .from("social_media_posts")
    .select("*")
    .order("posted_at", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("[social-dashboard] recent posts query failed:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Fetch top posts by total engagement (likes + comments + shares).
 */
async function fetchTopPosts() {
  const sb = getServerClient();
  // Supabase doesn't support computed order, so fetch recent and sort client-side
  const { data, error } = await sb
    .from("social_media_posts")
    .select("*")
    .order("posted_at", { ascending: false })
    .limit(100);

  if (error) {
    console.warn("[social-dashboard] top posts query failed:", error.message);
    return [];
  }

  return (data || [])
    .map((p) => ({
      ...p,
      totalEngagement: (p.likes || 0) + (p.comments || 0) + (p.shares || 0),
    }))
    .sort((a, b) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);
}

/**
 * Fetch profile snapshots for trend data (last 90 days).
 */
async function fetchProfileSnapshots() {
  const sb = getServerClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await sb
    .from("social_media_profile_snapshots")
    .select("*")
    .gte("snapshot_date", ninetyDaysAgo)
    .order("snapshot_date", { ascending: true });

  if (error) {
    console.warn("[social-dashboard] snapshots query failed:", error.message);
    return [];
  }
  return data || [];
}
