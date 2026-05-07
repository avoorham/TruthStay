alter table content_entries
  add column if not exists country text;

create index if not exists content_entries_country_idx
  on content_entries (country)
  where country is not null;

comment on column content_entries.country is
  'Country name in English (e.g. "Portugal", "Italy"). Captured during scraping from Google Places address_components.country (most reliable) or Claude extraction (fallback). Used for Explore page filtering.';
