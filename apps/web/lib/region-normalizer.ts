// Canonical map: raw content_entries.region variants → admin region key used in
// region_chip_stats.  Keys are lowercased for case-insensitive lookup.
// TODO(v2): replace unmapped strings with Places API reverse-geocoding.
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
