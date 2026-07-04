import { Response } from "express";
import { AuthRequest } from "../types";
import { Event } from "../models/Event";
import { EventParticipant } from "../models/EventParticipant";
import { EventMemory } from "../models/EventMemory";
import { ParticipantStatus } from "../config/constants";
import { logger } from "../utils/logger";

/** 判断当前用户是否为该活动的参与者（含发布者，状态为已接受） */
async function isParticipant(eventId: string, userId: any): Promise<boolean> {
  const p = await EventParticipant.findOne({
    eventId,
    userId,
    status: ParticipantStatus.ACCEPTED,
  });
  return !!p;
}

/**
 * POST /api/v1/events/:id/memory
 * 发布一条共同记忆（图文，仅参与者）
 * body: { content?: string, imageUrl?: string }
 */
export async function createMemory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const eventId = String(req.params.id);
    const { content, imageUrl } = req.body;

    if ((!content || !content.trim()) && !imageUrl) {
      res.status(400).json({ success: false, error: "请填写文字或上传图片" });
      return;
    }
    if (content && String(content).length > 1000) {
      res.status(400).json({ success: false, error: "文字不能超过1000字" });
      return;
    }

    const event = await Event.findById(eventId).select("_id");
    if (!event) {
      res.status(404).json({ success: false, error: "活动不存在" });
      return;
    }
    if (!(await isParticipant(eventId, req.user!.userId))) {
      res.status(403).json({ success: false, error: "只有活动参与者可以发布" });
      return;
    }

    const memory = await EventMemory.create({
      eventId,
      userId: req.user!.userId,
      content: (content || "").trim(),
      imageUrl: imageUrl || "",
    });

    logger.info(`[记忆墙] 用户 ${req.user!.numericId} 在活动 ${eventId} 发布记忆`);

    res.status(201).json({ success: true, data: memory, message: "已发布" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/v1/events/:id/memories
 * 获取活动的共同记忆（仅参与者可见）
 */
export async function listMemories(req: AuthRequest, res: Response): Promise<void> {
  try {
    const eventId = String(req.params.id);

    const event = await Event.findById(eventId).select("_id");
    if (!event) {
      res.status(404).json({ success: false, error: "活动不存在" });
      return;
    }
    if (!(await isParticipant(eventId, req.user!.userId))) {
      res.status(403).json({ success: false, error: "只有活动参与者可以查看" });
      return;
    }

    const memories = await EventMemory.find({ eventId })
      .sort({ createdAt: -1 })
      .populate("userId", "nickname avatar userId")
      .lean();

    res.json({ success: true, data: { memories, count: memories.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
