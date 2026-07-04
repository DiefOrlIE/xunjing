import api from "./api";
import { ApiResponse, CollectionItem } from "../types";

export async function getMyCollections(): Promise<ApiResponse<{ collections: CollectionItem[]; grouped: Record<string, CollectionItem[]> }>> {
  return api.get("/user/collections");
}

export async function getUserCollections(userId: number): Promise<ApiResponse<{ collections: CollectionItem[]; grouped: Record<string, CollectionItem[]> }>> {
  return api.get(`/user/${userId}/collections`);
}

export async function deleteCollectionItem(itemId: string): Promise<ApiResponse<{ remaining: number }>> {
  return api.delete(`/user/collections/${itemId}`);
}
