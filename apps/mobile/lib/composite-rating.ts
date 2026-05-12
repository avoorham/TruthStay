// Composite rating: weighted average of up to three 0–1 normalised signals.
//
// Signals and base weights:
//   google  0.5  — Google Places rating / 5
//   blog    0.3  — trust_score (blog/source mention frequency)
//   user    0.2  — user_review_score (average of TruthStay star ratings / 5)
//
// Missing signals are excluded; remaining weights are rescaled to sum to 1.
// Returns null when no signals are present → display "Not rated yet".

const BASE_WEIGHTS = { google: 0.5, blog: 0.3, user: 0.2 } as const;

export interface RatingSignals {
  trust_score: number | null;       // blog signal, already 0–1
  google_rating: number | null;     // 0–5 scale from Google
  user_review_score: number | null; // 0–1 normalised TruthStay user average
}

export function computeCompositeRating(signals: RatingSignals): number | null {
  const candidates: Array<{ value: number; baseWeight: number }> = [];

  if (signals.google_rating != null)
    candidates.push({ value: signals.google_rating / 5, baseWeight: BASE_WEIGHTS.google });
  if (signals.trust_score != null)
    candidates.push({ value: signals.trust_score,       baseWeight: BASE_WEIGHTS.blog });
  if (signals.user_review_score != null)
    candidates.push({ value: signals.user_review_score, baseWeight: BASE_WEIGHTS.user });

  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((s, c) => s + c.baseWeight, 0);
  return candidates.reduce((s, c) => s + c.value * (c.baseWeight / totalWeight), 0);
}

/** 0–1 composite → 0.5-precision 0–5 star value, or null if no signals. */
export function compositeToStars(signals: RatingSignals): number | null {
  const composite = computeCompositeRating(signals);
  if (composite == null) return null;
  return Math.round(composite * 5 * 2) / 2;
}
