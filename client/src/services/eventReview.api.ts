import api from "./api";
import { ApiResponse } from "../types";

export interface EventReviewItem {
  _id: string;
  userId: { _id: string; userId: number; nickname: string; avatar: string } | string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface EventReviewsResponse {
  reviews: EventReviewItem[];
  count: number;
  average: number;
  myReview: EventReviewItem | null;
}

/** 提交/更新活动评价 */
export async function submitReview(eventId: string, rating: number, comment: string): Promise<ApiResponse> {
  return api.post(`/events/${eventId}/review`, { rating, comment });
}

/** 获取活动评价列表 */
export async function getReviews(eventId: string): Promise<ApiResponse<EventReviewsResponse>> {
  return api.get(`/events/${eventId}/reviews`);
}
