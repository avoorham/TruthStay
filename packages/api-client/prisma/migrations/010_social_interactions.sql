-- Social interactions for the feed: adventure likes, adventure bookmarks,
-- and adventure-level comments. Post likes/comments already exist in init.sql.

-- Likes on public adventures (feed heart button)
CREATE TABLE IF NOT EXISTS adventure_likes (
  "userId"      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "adventureId" TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "adventureId")
);

-- Bookmarks: users saving public adventures as inspiration
CREATE TABLE IF NOT EXISTS adventure_bookmarks (
  "userId"      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "adventureId" TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "adventureId")
);

-- Comments on public adventures
CREATE TABLE IF NOT EXISTS adventure_comments (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "adventureId" TEXT NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "userId"      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adventure_likes_adventure ON adventure_likes("adventureId");
CREATE INDEX IF NOT EXISTS idx_adventure_bookmarks_adventure ON adventure_bookmarks("adventureId");
CREATE INDEX IF NOT EXISTS idx_adventure_comments_adventure ON adventure_comments("adventureId");