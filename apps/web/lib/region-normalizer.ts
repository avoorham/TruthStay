// Canonical map: raw content_entries.region variants → admin region key used in
// region_chip_stats.  Keys are lowercased for case-insensitive lookup.
// TODO(v2): replace unmapped strings with Places API reverse-geocoding.
//
// TODO: 25 region strings from the 2026-05-12 initial backfill fell through to
// the raw-value fallback and were not consolidated into a canonical admin region.
// Add mappings below (or hook up reverse-geocoding) before chip thresholds can
// fire for these areas.  Full list from backfill:
//   Dolomites, Italy · Olhos d'Água · Sintra, Portugal · Porto · Tuscany, Italy
//   Lisbon · Reykjavik · Mount Etna, Sicily · Scottish Borders / Northern England
//   Scotland · Selfoss · Höfn · Ferragudo, Algarve · Northern England
//   Northumberland, England · Oregon, USA · Monchique · Monchique / Aljezur
//   Vik · Algarve · Bjelopavlići plain, central Montenegro · Azinhal · Alvor
//   Sicily · Northern England and Scotland
const REGION_MAP: Record<string, string> = {
  // Algarve
  "algarve":                  "Algarve",
  "algarve, portugal":        "Algarve",
  "carvoeiro, algarve":       "Algarve",
  "carvoeiro":                "Algarve",
  "lagos, algarve":           "Algarve",
  "lagos":                    "Algarve",
  "albufeira":                "Algarve",
  "albufeira, algarve":       "Algarve",
  "vilamoura":                "Algarve",
  "portimão":                 "Algarve",
  "portimao":                 "Algarve",
  "sagres":                   "Algarve",
  "faro":                     "Algarve",
  // Lisbon
  "lisbon":                   "Lisbon",
  "lisboa":                   "Lisbon",
  "lisbon, portugal":         "Lisbon",
  "cascais":                  "Lisbon",
  "sintra":                   "Lisbon",
  "estoril":                  "Lisbon",
  // Porto
  "porto":                    "Porto",
  "porto, portugal":          "Porto",
  "oporto":                   "Porto",
  "vila nova de gaia":        "Porto",
  // Madeira
  "madeira":                  "Madeira",
  "funchal":                  "Madeira",
  "funchal, madeira":         "Madeira",
  // Azores
  "azores":                   "Azores",
  "açores":                   "Azores",
  "ponta delgada":            "Azores",
  // Alentejo
  "alentejo":                 "Alentejo",
  "évora":                    "Alentejo",
  "evora":                    "Alentejo",
  // Douro Valley
  "douro valley":             "Douro Valley",
  "douro":                    "Douro Valley",
  // Minho
  "minho":                    "Minho",
  "braga":                    "Minho",
  "guimarães":                "Minho",
  "viana do castelo":         "Minho",
};

/**
 * Normalise a raw region string to the canonical admin-region key stored in
 * region_chip_stats.  Unmapped strings fall back to the trimmed raw value —
 * the recompute job logs these so we can extend the map or hook up
 * reverse-geocoding in v2.
 */
export function normalizeToAdminRegion(rawRegion: string): string {
  const key = rawRegion.trim().toLowerCase();
  return REGION_MAP[key] ?? rawRegion.trim();
}
