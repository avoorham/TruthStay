# Update 4 — Explore Page Filter-Driven Map Pins & Tiles

Paste this into Claude Code:

```
On the Explore page in the TruthStay mobile app, the filter bottom sheet allows users to
switch between Vacations, Accommodations, Activities, and Restaurants. When a filter category
is selected, two things need to update:

1. MAP PINS — The pins on the map should change to reflect the selected filter:

   - "Vacations" (default): Show pins for public adventures/vacations. Pin style: the
     current default pins.
   - "Accommodations": Show pins for content_entries WHERE type = 'accommodation' AND
     verified = true. Pin style: a bed/house icon or a distinct colour (e.g., green pin).
   - "Activities": Show pins for content_entries WHERE type = 'route' AND verified = true,
     plus any POIs with activity categories. Pin style: a hiking/activity icon or distinct
     colour (e.g., blue pin).
   - "Restaurants": Show pins for content_entries WHERE type = 'restaurant' AND verified = true.
     Pin style: a fork/knife icon or distinct colour (e.g., orange pin).

   Each pin should use the coordinates from content_entries.data->'coordinates' (lat/lng).
   When a user taps a pin, show a preview card with the entry name, type, region, trust score,
   and a "View Details" button.

   The map should re-render pins when the filter changes — remove old pins and add new ones
   with a brief fade transition. Respect the map's current zoom/pan position when switching
   filters (don't reset the map view).

   Also apply the Duration and Budget sliders to filter results where applicable:
   - Duration slider: only relevant for Vacations (filter by adventure duration)
   - Budget slider: filter by price range where available (from content_entries.data->'priceRange')

2. SWIPE-UP TILES — The scrollable tile list that appears when you swipe up from the bottom
   of the Explore page should also change based on the filter:

   - "Vacations" (default): Show adventure/vacation cards as they currently appear
     (cover image, title, duration, difficulty, price indicator).
   - "Accommodations": Show accommodation cards from content_entries. Card should display:
     name, region, accommodation type (hotel/guesthouse/campsite), price range badge,
     highlights (e.g., "bike-friendly", "family-run"), trust score, source count.
   - "Activities": Show route/activity cards from content_entries. Card should display:
     name, region, distance (km), elevation gain (m), difficulty badge, activity type
     (cycling/hiking/surfing), trust score, source count.
   - "Restaurants": Show restaurant cards from content_entries. Card should display:
     name, region, cuisine type, price range badge, highlights (e.g., "local favourite",
     "mountain views"), trust score, source count.

   Each tile type should have its own card design that matches the existing vacation card
   style but is adapted for that content type. Use the same rounded card style, image area
   (or map thumbnail if no image), and metadata row pattern.

   Tiles should be sorted by trust_score DESC, then by proximity to the map centre.

   Tapping a tile should:
   - Centre the map on that pin
   - Open the detail view for that content entry
   - Log a user_interaction event (type: 'clicked')

3. DATA QUERIES — When a filter is selected, query content_entries:

   For Accommodations:
   SELECT * FROM content_entries
   WHERE type = 'accommodation' AND verified = true
   AND data->'coordinates' IS NOT NULL
   ORDER BY trust_score DESC;

   For Activities/Routes:
   SELECT * FROM content_entries
   WHERE type = 'route' AND verified = true
   AND data->'coordinates' IS NOT NULL
   ORDER BY trust_score DESC;

   For Restaurants:
   SELECT * FROM content_entries
   WHERE type = 'restaurant' AND verified = true
   AND data->'coordinates' IS NOT NULL
   ORDER BY trust_score DESC;

   If the map is zoomed to a specific area, filter by the visible map bounds:
   WHERE (data->'coordinates'->>'lat')::float BETWEEN south_lat AND north_lat
   AND (data->'coordinates'->>'lng')::float BETWEEN west_lng AND east_lng

   Re-query when the user pans/zooms the map (debounced, 500ms after map movement stops).

4. PIN STYLING — Each filter category gets a distinct pin appearance:
   - Vacations: current default pin style (keep as-is)
   - Accommodations: green pin with bed icon (🏨)
   - Activities: blue pin with activity icon (🚴 or 🥾 depending on activity_type)
   - Restaurants: orange pin with fork icon (🍽)

   Pins should have a subtle shadow and a white border to stand out against the map.
   Selected/tapped pin should scale up slightly (scale-110) and show a brighter colour.

5. FILTER STATE — The selected filter should persist while the user navigates the map.
   When switching back to "Vacations", restore the original vacation pins and tiles.
   The filter pills at the top (Vacations / Accommodations / Activities / Restaurants)
   should remain visible and tappable at all times, even when scrolling tiles.

6. EMPTY STATES — If a filter has no results in the current map area:
   - Map: show no pins (don't show vacation pins as fallback)
   - Tiles: show empty state: "No [accommodations/activities/restaurants] found in this area.
     Try zooming out or searching a different region."
   - If there are no content_entries of that type at all: "No [type] added yet.
     New places are being discovered regularly — check back soon!"
```
