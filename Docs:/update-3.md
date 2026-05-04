# Update 3 — Itinerary Add & Delete Tiles

Paste this into Claude Code:

```
In the TruthStay mobile app, on the Itinerary page (My Trips → select a trip → Itinerary view),
add two features: an Add button for user-generated content tiles, and a drag-to-delete interaction.

1. ADD BUTTON:
   - Add a floating "Add" button at the bottom of the itinerary for each day section
   - Button style: TruthStay blue (the same blue used in the app's "Find friends" button
     and primary CTAs — likely #3B82F6 or the brand blue from your Tailwind config)
     background, white text, rounded-full, px-6 py-3, font-medium, centered below the
     last tile of each day. Match the exact blue used in the app's existing buttons.
   - Text: "+ Add" with a plus icon
   - Tapping the button opens a bottom sheet / modal popup

2. ADD POPUP — Two options at the top:
   a) "Ask Discover" — Opens a mini chat interface where the user can ask the Discovery AI
      to suggest something (e.g., "find me a restaurant near Valkenburg"). The AI response
      creates a tile automatically using content from content_entries if available.
   b) "Add Manually" — Shows a form with these fields:
      - Title (text input, required)
      - Type (dropdown: Accommodation, Activity, Restaurant — required)
      - Description (textarea, optional)
      - Link / URL (text input, optional — e.g., a website or Google Maps link)
      - Photos (image upload, optional — multiple allowed)
      - Rating (star rating 1-5, optional)
      - Notes (textarea, optional — personal notes about this place)

   On submit:
   - Create a new tile in the itinerary for that day, styled to match the existing tile
     style for that type (accommodation tiles look like accommodation tiles, restaurant
     tiles look like restaurant tiles, etc.)
   - The tile appears with the same card style as AI-generated tiles (image area, title,
     description, distance/elevation badges where relevant, Directions/Route/Share buttons,
     star rating, notes field)
   - Save the data to the database:
     a) Create an adventure_day_pois record linking to the adventure day
     b) Create a content_entries record with source_type = 'user', verified = false
        (NOT auto-verified — user-submitted content from itinerary goes through review)
     c) The content entry gets evaluated against the scout trust score system before
        being pushed to public/verified status
   - Show a success toast: "Added to your itinerary! This place will be reviewed before
     appearing in public recommendations."

3. DRAG AND DROP — DELETE INTERACTION:
   - The itinerary already has drag and drop for reordering tiles
   - When a drag is initiated (user long-presses and starts moving a tile):
     a) The "Add" button at the bottom transforms into a "Delete" button
     b) Delete button style: red-500 background, white text, same size/position as Add button
     c) Icon changes from "+" to a trash can icon
     d) Smooth transition/animation between Add → Delete (scale + colour morph)
   - When the user drags a tile over the Delete button:
     a) The Delete button grows slightly (scale-110) and gets a red glow/shadow to indicate
        it's a drop target
     b) Visual feedback: the tile being dragged becomes semi-transparent (opacity-50)
   - When the user drops the tile on the Delete button:
     a) Show a confirmation popup/alert:
        Title: "Delete [tile name]?"
        Message: "Are you sure you want to remove [tile name] from your itinerary?"
        Buttons: "Cancel" (secondary/outline) and "Yes, Delete" (red-500 background)
     b) If "Yes, Delete" is tapped:
        - Remove the tile from the itinerary view with a fade-out animation
        - Delete the adventure_day_pois record
        - Do NOT delete the content_entries record (the place still exists in the database,
          just no longer in this user's itinerary)
        - Show a toast: "[tile name] removed from itinerary"
     c) If "Cancel" is tapped:
        - Return the tile to its original position with a snap-back animation
   - When the drag ends (dropped elsewhere or cancelled):
     a) The Delete button transforms back into the Add button
     b) Smooth transition back (Delete → Add)

4. DATA FLOW FOR USER-ADDED CONTENT:
   User adds a tile → saved to adventure_day_pois (their itinerary)
                    → saved to content_entries (source_type='user', verified=false)
                    → appears in admin dashboard Review Queue
                    → admin reviews and approves/rejects
                    → if approved, verified=true, trust score calculated
                    → content appears in public recommendations, scout learning, and feed

5. DESIGN DETAILS:
   - The Add button should be visually consistent with the TruthStay app design:
     teal accent, rounded, clean
   - The popup/bottom sheet should have rounded-t-2xl corners, white background,
     subtle shadow, with a drag handle at the top
   - The type selector (Accommodation/Activity/Restaurant) should use pill-style
     toggle buttons, not a dropdown — matching the app's Upcoming/Past toggle style
   - Photo upload should show thumbnails in a horizontal scroll row
   - The manually added tile should be visually indistinguishable from AI-generated tiles
     once created — users shouldn't see a difference
   - Add a small "Added by you" subtle badge (text-xs text-slate-400) on user-added tiles
     so the user knows which ones they added vs which the AI suggested

6. INTEGRATION WITH EXISTING DRAG AND DROP:
   - Find the existing drag and drop implementation on the itinerary page
   - The Add→Delete button transformation hooks into the drag start/end events
   - Make sure the delete drop zone doesn't interfere with normal tile reordering
   - The delete zone should only activate when the tile is dragged to the bottom
     of the screen (near the Add/Delete button area)
```
