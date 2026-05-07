-- Update 18: add things_to_do as a valid content_entries type
ALTER TABLE content_entries
  DROP CONSTRAINT IF EXISTS content_entries_type_check;

ALTER TABLE content_entries
  ADD CONSTRAINT content_entries_type_check
    CHECK (type IN ('route', 'accommodation', 'restaurant', 'activity', 'things_to_do'));
