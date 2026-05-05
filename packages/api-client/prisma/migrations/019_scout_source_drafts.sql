-- Per-admin draft: persists the working source list + restrict toggle between sessions.
-- One row per user (upsert on change). Cleared explicitly by the user via "Clear all".

create table if not exists scout_source_drafts (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  sources             jsonb not null default '[]'::jsonb,
  restrict_to_sources boolean not null default false,
  updated_at          timestamptz not null default now()
);

alter table scout_source_drafts enable row level security;

create policy "users manage own draft"
  on scout_source_drafts for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
