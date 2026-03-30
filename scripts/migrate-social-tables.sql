-- Social Media Tracking Tables
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/esoogmdwzcarvlodwbue/sql

CREATE TABLE IF NOT EXISTS social_media_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  platform_post_id TEXT NOT NULL UNIQUE,
  hero_id UUID REFERENCES heroes(id) ON DELETE SET NULL,
  caption TEXT,
  permalink TEXT,
  media_type TEXT,
  thumbnail_url TEXT,
  posted_at TIMESTAMPTZ,
  is_anniversary_post BOOLEAN DEFAULT FALSE,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  last_fetched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_media_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_posted ON social_media_posts(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_hero ON social_media_posts(hero_id);

CREATE TABLE IF NOT EXISTS social_media_profile_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform TEXT NOT NULL,
  username TEXT,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_social_profiles_date ON social_media_profile_snapshots(snapshot_date DESC);

-- Apply updated_at trigger
CREATE TRIGGER set_updated_at BEFORE UPDATE ON social_media_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
