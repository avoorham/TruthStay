-- Admin role table — DB-backed verification replaces user_metadata?.isAdmin check.
-- Insert admin users directly: INSERT INTO admin_users (user_id) VALUES ('your-auth-uuid');

CREATE TABLE IF NOT EXISTS admin_users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only service role can read/write this table (no permissive RLS policy)
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
