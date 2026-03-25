import type { ActivityType } from "./activity";

export const POI_CATEGORIES = [
  "hotel",
  "hostel",
  "campsite",
  "guesthouse",
  "restaurant",
  "cafe",
  "bar",
  "bike_shop",
  "trailhead",
  "viewpoint",
  "other",
] as const;

export type POICategory = (typeof POI_CATEGORIES)[number];

export interface POILocation {
  lat: number;
  lng: number;
}

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  location: POILocation;
  address: string | null;
  website: string | null;
  activityTypes: ActivityType[];
  averageRating: number | null;
  reviewCount: number;
  createdAt: string;
}
