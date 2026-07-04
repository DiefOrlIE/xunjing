import { Response } from "express";
import { AuthRequest } from "../types";
import { Event } from "../models/Event";
import { EventParticipant } from "../models/EventParticipant";
import { EventReview } from "../models/EventReview";
import { ActivityStatus, ParticipantStatus } from "../config/constants";
import { logger } from "../utils/logger";

/**
 * POST /api/v1/events/:id/review
 * 提交/更新活动评价（仅活动参与者、且活动已结束）
 * body: { rating: 1-5, comment?: string }
 */
export async function createReview(req: AuthRequest, res: Response): Promise<void> {
  try {
    const eventId = req.params.id;
    const { rating, comment } = req.body;

    const r = Number(rating);
    if (!r || r < 1 || r > 5) {
      res.status(400).json({ success: false, error: "评分需为 1-5" });
      return;
    }
    if (comment && String(comment).length > 500) {
      res.status(400).json({ success: false, error: "评价不能超过500字" });
      return;
    }

    const event = await Event.findById(eventId).select("status");
    if (!event) {
      res.status(404).json({ success: false, error: "活动不存在" });
      return;
    }
    if (event.status !== ActivityStatus.FINISHED) {
      res.status(400).json({ success: false, error: "活动结束后才能评价" });
      return;
    }

    // 仅参与者（含发布者）可评价
    const participant = await EventParticipant.findOne({
      eventId,
      userId: req.user!.userId,
      status: ParticipantStatus.ACCEPTED,
    });
    if (!participant) {
      res.status(403).json({ success: false, error: "只有参与者可以评价" });
      return;
    }

    // 一人一评，可覆盖
    const review = await EventReview.findOneAndUpdate(
      { eventId, userId: req.user!.userId },
      { rating: r, comment: (comment || "").trim() },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    logger.info(`[活动评价] 用户 ${req.user!.numericId} 评价活动 ${eventId}: ${r}星`);

    res.status(201).json({ success: true, data: review, message: "评价已提交" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/v1/events/:id/reviews
 * 获取活动的全部评价 + 平均分 + 我自己的评价
 */
export async function listReviews(req: AuthRequest, res: Response): Promise<void> {
  try {
    const eventId = req.params.id;

    const reviews = await EventReview.find({ eventId })
      .sort({ createdAt: -1 })
      .populate("userId", "nickname avatar userId")
      .lean();

    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / count : 0;
    const mine = reviews.find(
      (r: any) => String(r.userId?._id || r.userId) === String(req.user!.userId)
    );

    res.json({
      success: true,
      data: {
        reviews,
        count,
        average: Math.round(avg * 10) / 10,
        myReview: mine || null,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
