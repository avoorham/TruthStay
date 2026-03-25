import type { ActivityType } from "./activity";
import type { User } from "./user";

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Stage {
  id: string;
  tripId: string;
  title: string;
  date: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  /** URL to GPX file in storage */
  routeGpxUrl: string | null;
  notes: string | null;
  orderIndex: number;
  createdAt: string;
}

export interface Trip {
  id: string;
  userId: string;
  user?: User;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  region: string;
  coverImageUrl: string | null;
  activityType: ActivityType;
  isPublished: boolean;
  stages: Stage[];
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}
