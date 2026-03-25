import type { ActivityType } from "./activity";

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  activityTypes: ActivityType[];
  /** Home base city / region */
  location: string | null;
  followerCount: number;
  followingCount: number;
  createdAt: string;
}

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: string;
}
