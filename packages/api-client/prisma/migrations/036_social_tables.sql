-- Rebuild follows: drop email-based table, recreate with text ID columns matching users.id type
DROP TABLE IF EXISTS follows;

CREATE TABLE follows (
  "followerId"  text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "followingId" text        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("followerId", "followingId")
);

-- Social interaction tables for adventures
CREATE TABLE adventure_likes (
  "userId"      text        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  "adventureId" text        NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "adventureId")
);

CREATE TABLE adventure_bookmarks (
  "userId"      text        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  "adventureId" text        NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "createdAt"   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("userId", "adventureId")
);

CREATE TABLE adventure_comments (
  id            text        PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  "adventureId" text        NOT NULL REFERENCES adventures(id) ON DELETE CASCADE,
  "userId"      text        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  body          text        NOT NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON adventure_comments ("adventureId");
