/**
 * Social Media Daily Snapshot Cron
 *
 * Runs daily at 10:30 UTC (6:30 AM ET). Pulls current profile metrics
 * from Instagram and Facebook via Meta Graph API, saves daily snapshots
 * to Supabase, and upserts recent posts.
 *
 * Tables:
 *   social_media_profile_snapshots — one row per platform per day
 *   social_media_posts             — upserted by platform_post_id
 */

import { NextResponse } from "next/server";
import {
  getInstagramProfile,
  getInstagramPosts,
  getFacebookProfile,
  getFacebookPosts,
} from "@/lib/meta";
import { persistProfileSnapshot, persistPosts } from "@/lib/social-persist";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  // Auth — matches pattern from anniversary-outreach cron
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const apiKey = process.env.SHOS_API_KEY;
  const key = request.headers.get("x-api-key");

  const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isApiKey = apiKey && key === apiKey;

  if (!isVercelCron && !isApiKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    instagram: { profile: null, posts: 0, errors: [] },
    facebook: { profile: null, posts: 0, errors: [] },
  };

  // --- Instagram ---
  try {
    const igProfile = await getInstagramProfile();
    results.instagram.profile = {
      followers: igProfile.followers,
      following: igProfile.following,
      posts: igProfile.posts,
    };
    await persistProfileSnapshot("instagram", igProfile);
  } catch (err) {
    results.instagram.errors.push(`profile: ${err.message}`);
  }

  try {
    const igPosts = await getInstagramPosts(25);
    results.instagram.posts = igPosts.length;
    await persistPosts("instagram", igPosts);
  } catch (err) {
    results.instagram.errors.push(`posts: ${err.message}`);
  }

  // --- Facebook ---
  try {
    const fbProfile = await getFacebookProfile();
    results.facebook.profile = {
      followers: fbProfile.followers,
    };
    await persistProfileSnapshot("facebook", fbProfile);
  } catch (err) {
    results.facebook.errors.push(`profile: ${err.message}`);
  }

  try {
    const fbPosts = await getFacebookPosts(25);
    results.facebook.posts = fbPosts.length;
    await persistPosts("facebook", fbPosts);
  } catch (err) {
    results.facebook.errors.push(`posts: ${err.message}`);
  }

  const hasErrors =
    results.instagram.errors.length > 0 || results.facebook.errors.length > 0;

  return NextResponse.json({
    success: !hasErrors,
    snapshot_date: new Date().toISOString().split("T")[0],
    ...results,
  });
}
