import type { POI } from "./poi";
import type { User } from "./user";

export interface Review {
  id: string;
  userId: string;
  user?: User;
  tripId: string | null;
  poi: POI;
  poiId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  wouldRecommend: boolean;
  pros: string[];
  cons: string[];
  body: string | null;
  visitedAt: string;
  createdAt: string;
}
