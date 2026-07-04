import { Response } from "express";
import { AuthRequest } from "../types";
import { Report } from "../models/Report";
import { User } from "../models/User";
import { logger } from "../utils/logger";

/**
 * 普通用户：提交举报（举报用户或活动）
 * POST /api/v1/reports
 */
export async function createReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { targetType, targetId, reason } = req.body;
    if (targetType !== "user" && targetType !== "event") {
      res.status(400).json({ success: false, error: "无效的举报类型" });
      return;
    }
    if (!targetId) {
      res.status(400).json({ success: false, error: "缺少举报对象" });
      return;
    }
    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, error: "请填写举报原因" });
      return;
    }
    if (reason.trim().length > 500) {
      res.status(400).json({ success: false, error: "举报原因不能超过500字" });
      return;
    }

    const report = await Report.create({
      reporterId: req.user!.userId,
      targetType,
      targetId,
      reason: reason.trim(),
      status: "pending",
    });

    logger.info(`[举报] 用户 ${req.user!.numericId} 举报了 ${targetType}:${targetId}`);

    res.status(201).json({ success: true, data: report, message: "举报已提交，我们会尽快处理" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 管理员：获取举报列表
 * GET /api/v1/admin/reports
 */
export async function listReports(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const filter: any = {};
    if (status === "pending" || status === "resolved" || status === "dismissed") {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate("reporterId", "nickname userId avatar")
        .populate("handledBy", "nickname userId")
        .lean(),
      Report.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 管理员：处理举报（标记已处理/驳回，可附处理说明）
 * PUT /api/v1/admin/reports/:id
 */
export async function resolveReport(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    const report = await Report.findById(id);
    if (!report) {
      res.status(404).json({ success: false, error: "举报不存在" });
      return;
    }

    if (status) report.status = status;
    if (adminNote !== undefined) report.adminNote = adminNote;
    if (status === "resolved" || status === "dismissed") {
      report.handledBy = req.user!.userId as any;
      report.handledAt = new Date();
    }

    await report.save();

    logger.info(`[管理员] 处理举报 ${id}: status=${report.status}`);

    res.json({ success: true, data: report, message: "举报状态已更新" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * 管理员：封禁/解封用户
 * PATCH /api/v1/admin/users/:id/ban
 * body: { banned: boolean, banReason?: string, banDays?: number } banDays 缺省或0=永久
 */
export async function banUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { banned, banReason, banDays } = req.body;

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ success: false, error: "用户不存在" });
      return;
    }

    user.banned = !!banned;
    user.banReason = banned ? (banReason || "") : "";
    user.bannedUntil = banned && banDays ? new Date(Date.now() + banDays * 24 * 3600 * 1000) : null;
    await user.save();

    logger.info(`[管理员] ${banned ? "封禁" : "解封"}用户 ${user.userId} (${user.nickname})`);

    res.json({ success: true, message: banned ? "用户已封禁" : "用户已解封" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
