import api from "./api";
import { ApiResponse } from "../types";

export interface ReportItem {
  _id: string;
  reporterId: { _id: string; userId: number; nickname: string; avatar: string };
  targetType: "user" | "event";
  targetId: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  adminNote: string;
  handledBy: { _id: string; userId: number; nickname: string } | null;
  handledAt: string | null;
  createdAt: string;
}

export interface ReportListResponse {
  items: ReportItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 提交举报 */
export async function submitReport(targetType: "user" | "event", targetId: string, reason: string): Promise<ApiResponse> {
  return api.post("/reports", { targetType, targetId, reason });
}

/** 管理员：获取举报列表 */
export async function getAllReports(
  page = 1,
  limit = 20,
  status?: "pending" | "resolved" | "dismissed"
): Promise<ApiResponse<ReportListResponse>> {
  return api.get("/admin/reports", { params: { page, limit, status } });
}

/** 管理员：处理举报 */
export async function resolveReport(
  id: string,
  data: { status?: "resolved" | "dismissed"; adminNote?: string }
): Promise<ApiResponse> {
  return api.put(`/admin/reports/${id}`, data);
}

/** 管理员：封禁/解封用户 */
export async function banUser(
  userMongoId: string,
  data: { banned: boolean; banReason?: string; banDays?: number }
): Promise<ApiResponse> {
  return api.patch(`/admin/users/${userMongoId}/ban`, data);
}
