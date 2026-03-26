-- TruthStay — Initial Schema
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- Enums
CREATE TYPE "ActivityType" AS ENUM (
  'cycling', 'hiking', 'trail_running', 'skiing',
  'snowboarding', 'kayaking', 'climbing', 'other'
);

CREATE TYPE "POICategory" AS ENUM (
  'hotel', 'hostel', 'campsite', 'guesthouse', 'restaurant',
  'cafe', 'bar', 'bike_shop', 'trailhead', 'viewpoint', 'other'
);

CREATE TYPE "NotificationType" AS ENUM (
  'like_post', 'like_trip', 'comment', 'follow', 'review_poi'
);

-- Users
CREATE TABLE users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "authId"      TEXT UNIQUE NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  "displayName" TEXT NOT NULL,
  "avatarUrl"   TEXT,
  bio           TEXT,
  location      TEXT,
  "activityTypes" "ActivityType"[] DEFAULT '{}',
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Follows
CREATE TABLE follows (
  "followerId"  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "followingId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("followerId", "followingId")
);

-- Trips
CREATE TABLE trips (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  "startDate"     DATE NOT NULL,
  "endDate"       DATE NOT NULL,
  region          TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "activityType"  "ActivityType" NOT NULL,
  "isPublished"   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stages
CREATE TABLE stages (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tripId"         TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  date             DATE NOT NULL,
  "distanceKm"     DOUBLE PRECISION,
  "elevationGainM" DOUBLE PRECISION,
  "routeGpxUrl"    TEXT,
  notes            TEXT,
  "orderIndex"     INTEGER NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Points of Interest
CREATE TABLE pois (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name            TEXT NOT NULL,
  category        "POICategory" NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  address         TEXT,
  website         TEXT,
  "activityTypes" "ActivityType"[] DEFAULT '{}',
  "createdById"   TEXT REFERENCES users(id) ON DELETE SET NULL,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews
CREATE TABLE reviews (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "poiId"          TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  "tripId"         TEXT REFERENCES trips(id) ON DELETE SET NULL,
  rating           INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  "wouldRecommend" BOOLEAN NOT NULL,
  pros             TEXT[] DEFAULT '{}',
  cons             TEXT[] DEFAULT '{}',
  body             TEXT,
  "visitedAt"      DATE NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("userId", "poiId", "visitedAt")
);

-- Posts
CREATE TABLE posts (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "tripId"    TEXT REFERENCES trips(id) ON DELETE SET NULL,
  "stageId"   TEXT REFERENCES stages(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  "mediaUrls" TEXT[] DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Post ↔ POI mentions (many-to-many)
CREATE TABLE post_poi_mentions (
  "postId" TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  "poiId"  TEXT NOT NULL REFERENCES pois(id) ON DELETE CASCADE,
  PRIMARY KEY ("postId", "poiId")
);

-- Post likes
CREATE TABLE post_likes (
  "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "postId"    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "postId")
);

-- Trip likes
CREATE TABLE trip_likes (
  "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "tripId"    TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("userId", "tripId")
);

-- Comments
CREATE TABLE comments (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "postId"    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  "userId"    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          "NotificationType" NOT NULL,
  "referenceId" TEXT NOT NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_trips_user ON trips("userId");
CREATE INDEX idx_trips_region ON trips(region);
CREATE INDEX idx_stages_trip ON stages("tripId");
CREATE INDEX idx_posts_user ON posts("userId");
CREATE INDEX idx_posts_trip ON posts("tripId");
CREATE INDEX idx_reviews_poi ON reviews("poiId");
CREATE INDEX idx_reviews_user ON reviews("userId");
CREATE INDEX idx_pois_category ON pois(category);
CREATE INDEX idx_pois_location ON pois(lat, lng);
CREATE INDEX idx_notifications_user ON notifications("userId");
CREATE INDEX idx_follows_follower ON follows("followerId");
CREATE INDEX idx_follows_following ON follows("followingId");
