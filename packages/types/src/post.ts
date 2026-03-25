import type { POI } from "./poi";
import type { User } from "./user";

export interface Post {
  id: string;
  userId: string;
  user?: User;
  tripId: string | null;
  stageId: string | null;
  body: string;
  mediaUrls: string[];
  poiMentions: POI[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  user?: User;
  body: string;
  createdAt: string;
}
