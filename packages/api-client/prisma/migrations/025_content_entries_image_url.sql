alter table content_entries
  add column if not exists image_url text;

comment on column content_entries.image_url is
  'URL of the most relevant image for this entry, identified during scraping. Hot-linked from source. Future: replace with rehosted Supabase Storage URL for user-facing display.';
