/**
 * Meta Graph API Route
 *
 * Exposes Meta (Facebook + Instagram) data to the SHOS app.
 *
 * GET ?action=fb_posts      — Recent Facebook posts with engagement
 * GET ?action=ig_posts      — Recent Instagram posts with engagement
 * GET ?action=ig_profile    — Instagram profile stats
 * GET ?action=fb_insights   — Page-level insights
 * GET ?action=comments&id=X — Comments on a specific post
 * GET ?action=token_health  — Check token expiry
 * GET (no action)           — Combined dashboard data
 */

import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import {
  getFacebookPosts,
  getInstagramPosts,
  getInstagramProfile,
  getFacebookInsights,
  getPostComments,
  checkTokenHealth,
} from "@/lib/meta";
import { persistPosts, persistProfileSnapshot } from "@/lib/social-persist";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  try {
    switch (action) {
      case "fb_posts": {
        const fbPosts = await getFacebookPosts(limit);
        persistPosts("facebook", fbPosts).catch(() => {});
        return NextResponse.json({ success: true, posts: fbPosts });
      }

      case "ig_posts": {
        const igPosts = await getInstagramPosts(limit);
        persistPosts("instagram", igPosts).catch(() => {});
        return NextResponse.json({ success: true, posts: igPosts });
      }

      case "ig_profile": {
        const profile = await getInstagramProfile();
        persistProfileSnapshot("instagram", profile).catch(() => {});
        return NextResponse.json({ success: true, profile });
      }

      case "fb_insights":
        return NextResponse.json({ success: true, insights: await getFacebookInsights() });

      case "comments": {
        const postId = searchParams.get("id");
        if (!postId) return NextResponse.json({ error: "Missing post id" }, { status: 400 });
        return NextResponse.json({ success: true, comments: await getPostComments(postId, limit) });
      }

      case "token_health":
        return NextResponse.json({ success: true, token: await checkTokenHealth() });

      default: {
        // Combined dashboard: IG profile + recent posts from both platforms
        const [igProfile, fbPosts, igPosts] = await Promise.all([
          getInstagramProfile().catch(() => null),
          getFacebookPosts(5).catch(() => []),
          getInstagramPosts(5).catch(() => []),
        ]);
        // Persist in background — never blocks response
        if (igProfile) persistProfileSnapshot("instagram", igProfile).catch(() => {});
        if (fbPosts.length) persistPosts("facebook", fbPosts).catch(() => {});
        if (igPosts.length) persistPosts("instagram", igPosts).catch(() => {});
        return NextResponse.json({
          success: true,
          instagram: igProfile,
          recentFacebook: fbPosts,
          recentInstagram: igPosts,
        });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Meta API error" },
      { status: 500 }
    );
  }
}
