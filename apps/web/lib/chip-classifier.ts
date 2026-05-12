import Anthropic from "@anthropic-ai/sdk";

export { normalizeToAdminRegion } from "./region-normalizer";

// ─── Threshold tiers ──────────────────────────────────────────────────────────
// Used by the recompute job to decide whether a (region, chip) pair is active.
// min_fraction guards against chips that pass min_entries on tiny region datasets.
// Switch tiers by user-base size; v1 is the starting config.
export const THRESHOLD_TIERS = {
  v1:   { min_entries: 3,  min_fraction: 0.05 },  // 0–500 MAU
  v1_5: { min_entries: 5,  min_fraction: 0.05 },  // 500–2 000 MAU
  v2:   { min_entries: 10, min_fraction: 0.05 },  // >2 000 MAU
} as const;

export const ACTIVE_TIER: keyof typeof THRESHOLD_TIERS = "v1";

// ─── Chip type ────────────────────────────────────────────────────────────────
export interface ChipTaxonomyRow {
  id:       string;
  slug:     string;
  label:    string;
  category: "restaurant" | "things_to_do" | "activity";
}

// Map content_entries.type → chip category
function chipCategoryForEntryType(
  entryType: string,
): "restaurant" | "things_to_do" | "activity" | null {
  if (entryType === "restaurant")   return "restaurant";
  if (entryType === "things_to_do") return "things_to_do";
  if (entryType === "activity" || entryType === "route") return "activity";
  return null;
}

// ─── Classifier ───────────────────────────────────────────────────────────────
/**
 * Classify a single content entry into zero or more chip slugs.
 *
 * The caller must supply the full chip taxonomy (loaded once from DB).
 * The LLM receives human-readable labels; this function resolves them to slugs.
 *
 * TODO(scale): batch Haiku calls 5-at-a-time with Promise.all when the total
 * row count being classified exceeds ~200.
 */
export async function classifyEntry(
  entry: { id: string; name: string; description?: string | null; type: string },
  allChips: ChipTaxonomyRow[],
): Promise<string[]> {
  const category = chipCategoryForEntryType(entry.type);
  if (!category) return [];

  const relevant = allChips.filter(c => c.category === category);
  if (relevant.length === 0) return [];

  const labelList = relevant.map(c => c.label).join(", ");

  const prompt =
    `You are tagging a travel listing for a holiday-planning app.\n\n` +
    `Listing name: ${entry.name}\n` +
    (entry.description ? `Description: ${entry.description}\n` : "") +
    `\nAvailable tags (${category}): ${labelList}\n\n` +
    `Return a JSON array of tag labels from the list above that clearly apply ` +
    `to this listing. Include every label that genuinely fits — use exact ` +
    `label strings from the list, no paraphrasing. Return [] if none fit. ` +
    `Return only valid JSON — no markdown fences, no explanation.`;

  const client = new Anthropic();
  const response = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 128,
    messages:   [{ role: "user", content: prompt }],
  });

  const raw =
    response.content[0]?.type === "text" ? response.content[0].text.trim() : "";

  let matchedLabels: unknown;
  try {
    matchedLabels = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(matchedLabels)) return [];

  return (matchedLabels as unknown[])
    .filter((l): l is string => typeof l === "string")
    .map(label => relevant.find(c => c.label === label)?.slug)
    .filter((slug): slug is string => slug !== undefined);
}
