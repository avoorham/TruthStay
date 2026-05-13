// EVOLUTION STRATEGY (do not auto-build these — make deliberate decisions):
//
// Stage 1 (current): in-code REGION_MAP. Works while total raw strings
//   stay under ~100. Maintained manually.
//
// Stage 2 (when needed): database-backed region_aliases table with
//   admin review UI. Triggered when recompute starts surfacing >10
//   new unmapped strings per week.
//
// Stage 2-alt: Places API reverse geocoding from content_entry
//   coordinates. Bypasses string parsing entirely. Cost: one Places
//   API call per entry (already restricted on the key). Becomes
//   viable when most content_entries have place_id populated.
//
// Do NOT auto-trigger any of these based on row counts — they are
// architectural decisions, not implementation switches. Evaluate
// fresh when the monitoring signal in chips/recompute indicates
// Stage 1 is creaking.
//
// Iceland note: Reykjavik, Selfoss, Höfn, Vik are intentionally
// unmapped — those entries exist only under type='accommodation',
// which has no chip taxonomy in v1. Map them when accommodation
// chips are introduced.

const REGION_MAP: Record<string, string> = {
  // Algarve
  "algarve":                    "Algarve",
  "algarve, portugal":          "Algarve",
  "carvoeiro, algarve":         "Algarve",
  "carvoeiro":                  "Algarve",
  "ferragudo, algarve":         "Algarve",
  "ferragudo":                  "Algarve",
  "lagos, algarve":             "Algarve",
  "lagos":                      "Algarve",
  "albufeira":                  "Algarve",
  "albufeira, algarve":         "Algarve",
  "vilamoura":                  "Algarve",
  "portimão":                   "Algarve",
  "portimao":                   "Algarve",
  "sagres":                     "Algarve",
  "faro":                       "Algarve",
  // Lisbon
  "lisbon":                     "Lisbon",
  "lisboa":                     "Lisbon",
  "lisbon, portugal":           "Lisbon",
  "cascais":                    "Lisbon",
  "estoril":                    "Lisbon",
  // Sintra — own canonical; distinct from Lisbon (UNESCO, palaces, day-trip dynamics)
  "sintra":                     "Sintra",
  "sintra, portugal":           "Sintra",
  // Porto
  "porto":                      "Porto",
  "porto, portugal":            "Porto",
  "oporto":                     "Porto",
  "vila nova de gaia":          "Porto",
  // Madeira
  "madeira":                    "Madeira",
  "funchal":                    "Madeira",
  "funchal, madeira":           "Madeira",
  // Azores
  "azores":                     "Azores",
  "açores":                     "Azores",
  "ponta delgada":              "Azores",
  // Alentejo
  "alentejo":                   "Alentejo",
  "évora":                      "Alentejo",
  "evora":                      "Alentejo",
  // Douro Valley
  "douro valley":               "Douro Valley",
  "douro":                      "Douro Valley",
  // Minho
  "minho":                      "Minho",
  "braga":                      "Minho",
  "guimarães":                  "Minho",
  "viana do castelo":           "Minho",
  // Sicily
  "sicily":                     "Sicily",
  "mount etna, sicily":         "Sicily",
  "mount etna":                 "Sicily",
  // Tuscany
  "tuscany":                    "Tuscany",
  "tuscany, italy":             "Tuscany",
  // Dolomites
  "dolomites":                  "Dolomites",
  "dolomites, italy":           "Dolomites",
  // Scotland
  "scotland":                   "Scotland",
  "scottish borders / northern england": "Scotland",
  "northern england and scotland":       "Scotland",
  // Northern England
  "northern england":           "Northern England",
  "northumberland, england":    "Northern England",
  "northumberland":             "Northern England",
  // Montenegro
  "montenegro":                 "Montenegro",
  "bjelopavlički plain, central montenegro": "Montenegro",
  "bjelopavlici plain, central montenegro":  "Montenegro",
  // Oregon
  "oregon":                     "Oregon",
  "oregon, usa":                "Oregon",
  // New York
  "new york":                   "New York",
  "adirondacks, new york, usa": "New York",
  "adirondacks":                "New York",
};

/**
 * Normalise a raw region string to the canonical admin-region key stored in
 * region_chip_stats.  Unmapped strings fall back to the trimmed raw value —
 * the recompute job logs these when they are not already known canonicals.
 */
export function normalizeToAdminRegion(rawRegion: string): string {
  const key = rawRegion.trim().toLowerCase();
  return REGION_MAP[key] ?? rawRegion.trim();
}

/**
 * Set of all canonical region names (the values of REGION_MAP).
 * Used by the recompute job to distinguish a genuinely unmapped string
 * from a raw value that happens to equal its own canonical (e.g. "Porto"
 * → "Porto").  If the normalised result is in this set, the string is
 * known; if not, it is a new raw variant the map doesn't cover yet.
 */
export const CANONICAL_REGIONS = new Set(Object.values(REGION_MAP));
