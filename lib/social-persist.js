/**
 * Social Media Persistence Layer
 *
 * Upserts posts and profile snapshots to Supabase when Meta API data is fetched.
 * Runs silently — errors are logged but never block the API response.
 */

import { getServerClient } from "@/lib/supabase";

/**
 * Upsert Facebook or Instagram posts into social_media_posts table.
 * @param {"facebook"|"instagram"} platform
 * @param {Array} posts — normalized post objects from lib/meta.js
 */
export async function persistPosts(platform, posts) {
  if (!posts?.length) return;

  const sb = getServerClient();
  const rows = posts.map((p) => ({
    platform,
    platform_post_id: p.id,
    caption: p.message || p.caption || null,
    permalink: p.permalink,
    media_type: p.mediaType || null,
    thumbnail_url: p.thumbnailUrl || null,
    posted_at: p.createdAt,
    likes: p.likes || 0,
    comments: p.comments || 0,
    shares: p.shares || 0,
    last_fetched_at: new Date().toISOString(),
  }));

  const { error } = await sb
    .from("social_media_posts")
    .upsert(rows, { onConflict: "platform_post_id" });

  if (error) {
    console.warn(`[social-persist] posts upsert failed:`, error.message);
  }
}

/**
 * Snapshot Instagram profile stats (one per platform per day).
 * @param {object} profile — from getInstagramProfile()
 */
export async function persistProfileSnapshot(profile) {
  if (!profile?.username) return;

  const sb = getServerClient();
  const { error } = await sb
    .from("social_media_profile_snapshots")
    .upsert(
      {
        platform: "instagram",
        username: profile.username,
        followers: profile.followers || 0,
        following: profile.following || 0,
        post_count: profile.posts || 0,
        snapshot_date: new Date().toISOString().split("T")[0],
      },
      { onConflict: "platform,snapshot_date" }
    );

  if (error) {
    console.warn(`[social-persist] profile snapshot failed:`, error.message);
  }
}
