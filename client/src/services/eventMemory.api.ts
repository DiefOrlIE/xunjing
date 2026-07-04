import api from "./api";
import { ApiResponse } from "../types";

export interface EventMemoryItem {
  _id: string;
  userId: { _id: string; userId: number; nickname: string; avatar: string } | string;
  content: string;
  imageUrl: string;
  createdAt: string;
}

export interface EventMemoriesResponse {
  memories: EventMemoryItem[];
  count: number;
}

/** 发布一条共同记忆 */
export async function submitMemory(eventId: string, content: string, imageUrl: string): Promise<ApiResponse> {
  return api.post(`/events/${eventId}/memory`, { content, imageUrl });
}

/** 获取活动的共同记忆（仅参与者） */
export async function getMemories(eventId: string): Promise<ApiResponse<EventMemoriesResponse>> {
  return api.get(`/events/${eventId}/memories`);
}

/** 上传记忆墙图片，返回图片 url */
export async function uploadMemoryImage(form: FormData): Promise<ApiResponse<{ url: string }>> {
  return api.post(`/upload/memory-image`, form);
}
