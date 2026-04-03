import OpenAI from "openai";
import { createHash } from "node:crypto";

let _client: OpenAI | null = null;
function client() {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

// In-process embedding cache — avoids repeat API calls for identical text within a warm instance.
const _embeddingCache = new Map<string, number[]>();
const MAX_CACHE_ENTRIES = 500;

export async function generateEmbedding(text: string): Promise<number[]> {
  const sliced = text.slice(0, 8000);
  const key = createHash("sha256").update(sliced).digest("hex");
  const cached = _embeddingCache.get(key);
  if (cached) return cached;

  const res = await client().embeddings.create({
    model: "text-embedding-3-small",
    input: sliced,
  });
  const embedding = res.data[0].embedding;

  if (_embeddingCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = _embeddingCache.keys().next().value;
    if (firstKey !== undefined) _embeddingCache.delete(firstKey);
  }
  _embeddingCache.set(key, embedding);
  return embedding;
}

export interface ContentEntryInput {
  type: "route" | "accommodation" | "restaurant";
  name: string;
  region: string;
  activity_type?: string | null;
  description?: string | null;
  data?: Record<string, unknown>;
}

/** Build a plain-text description of an entry for embedding. */
export function entryToText(e: ContentEntryInput): string {
  const parts: string[] = [`${e.type}: ${e.name}`, `Region: ${e.region}`];
  if (e.activity_type) parts.push(`Activity: ${e.activity_type}`);
  if (e.description)   parts.push(e.description);
  const d = e.data ?? {};
  if (d.cuisine)              parts.push(`Cuisine: ${d.cuisine}`);
  if (d.price_range)          parts.push(`Price: ${d.price_range}`);
  if (d.notes)                parts.push(String(d.notes));
  if (d.sport_friendly_notes) parts.push(String(d.sport_friendly_notes));
  if (d.distance_km)          parts.push(`${d.distance_km} km`);
  if (d.elevation_gain_m)     parts.push(`↑${d.elevation_gain_m} m`);
  return parts.join(". ");
}
