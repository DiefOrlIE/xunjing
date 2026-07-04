import { Response } from "express";
import { AuthRequest } from "../types";
import { Event } from "../models/Event";
import { EventParticipant } from "../models/EventParticipant";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { ActivityStatus, ParticipantStatus, NotificationType } from "../config/constants";
import { canTransitionActivity, canTransitionParticipant } from "../services/status.service";
import { createNotification, createNotificationsForMany } from "../services/notification.service";
import { getRedis } from "../config/redis";
import { getIO } from "../socket";
import { logger } from "../utils/logger";

/**
 * GET /api/v1/events
 * 活动广场接口：支持状态/类型/关键词筛选
 */
export async function listEvents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, campus, typeId, keyword, page = "1", limit = "30" } = req.query;
    const filter: any = {};

    if (status) {
      filter.status = status;
    } else {
      // 默认返回招募中和进行中的活动
      filter.status = { $in: [ActivityStatus.RECRUITING, ActivityStatus.ONGOING] };
    }
    if (campus) filter.campus = campus;
    if (typeId) filter.typeId = typeId;
    if (keyword) {
      filter.$or = [
        { title: { $regex: keyword as string, $options: "i" } },
        { description: { $regex: keyword as string, $options: "i" } },
        { locationText: { $regex: keyword as string, $options: "i" } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 30));

    const [events, total] = await Promise.all([
      Event.find(filter)
        .populate("typeId", "name iconUrl color")
        .populate("hostId", "nickname avatar userId")
        .sort({ startTime: 1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Event.countDocuments(filter),
    ]);

    res.json({ success: true, data: { events, total, page: pageNum, limit: limitNum } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/v1/events
 * 创建招募活动
 */
export async function createEvent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { typeId, title, startTime, endTime, capacity, campus, locationText, meetCoordinates, description } = req.body;

    // 时间校验
    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (start <= now) {
      res.status(400).json({ success: false, error: "开始时间不能早于当前时间" });
      return;
    }
    if (end <= start) {
      res.status(400).json({ success: false, error: "结束时间必须晚于开始时间" });
      return;
    }

    const event = await Event.create({
      hostId: req.user!.userId,
      title: title || "",
      typeId,
      startTime: start,
      endTime: end,
      capacity,
      campus,
      locationText,
      meetCoordinates,
      description: description || "",
      status: ActivityStatus.RECRUITING,
      currentParticipants: 1, // 包含发布者自己
    });

    // 创建发布者的参与记录
    await EventParticipant.create({
      eventId: event._id,
      userId: req.user!.userId,
      role: "host",
      status: ParticipantStatus.ACCEPTED,
    });

    // 更新用户统计
    await User.findByIdAndUpdate(req.user!.userId, {
      $inc: { "stats.hostedEvents": 1 },
    });

    res.status(201).json({ success: true, data: event, message: "活动发布成功！" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/v1/events/my
 * 获取我的活动列表（作为发布者或参与者）
 */
export async function getMyEvents(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const participants = await EventParticipant.find({
      userId,
      status: { $nin: [ParticipantStatus.EXITED, ParticipantStatus.REJECTED] },
    })
      .populate({ path: "eventId", populate: { path: "typeId" } })
      .sort({ appliedAt: -1 })
      .lean();

    // 过滤已删除的活动（populate 返回 null），展开 event 并附带参与信息
    const events = participants
      .filter((p) => p.eventId != null)
      .map((p) => {
        const eventObj = p.eventId as any;
        // lean() 返回的是 POJO，直接展开；非 lean 的 Mongoose 文档用 _doc
        const base = eventObj._doc || eventObj;
        return {
          ...base,
          myRole: p.role,
          myStatus: p.status,
        };
      });

    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/v1/events/:id
 * 获取活动详情
 */
export async function getEventDetail(req: AuthRequest, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id).populate("typeId hostId", "name iconUrl color nickname avatar userId");
    if (!event) {
      res.status(404).json({ success: false, error: "活动不存在" });
      return;
    }

    // 查询当前用户在该活动中的角色
    const participant = await EventParticipant.findOne({
      eventId: event._id,
      userId: req.user!.userId,
    });

    // 查询所有参与者
    const participants = await EventParticipant.find({
      eventId: event._id,
      status: { $in: [ParticipantStatus.ACCEPTED, ParticipantStatus.APPLIED] },
    }).populate("userId", "nickname avatar userId");

    res.json({
      success: true,
      data: {
        event,
        myRole: participant?.role || null,
        myStatus: participant?.status || null,
        participants,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/v1/events/:id/apply
 * 申请加入活动
 */
export async function applyToEvent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const eventId = req.params.id as string;
    const userId = req.user!.userId;

    const event = await Event.findById(eventId);
    if (!event || event.status !== ActivityStatus.RECRUITING) {
      res.status(400).json({ success: false, error: "活动不在招募中" });
      return;
    }

    if (event.currentParticipants >= event.capacity) {
      res.status(400).json({ success: false, error: "活动人数已满" });
      return;
    }

    // 检查是否已申请（排除已退出/被拒绝的记录，允许重新申请）
    const existing = await EventParticipant.findOne({
      eventId,
      userId,
      status: { $nin: [ParticipantStatus.EXITED, ParticipantStatus.REJECTED] },
    });
    if (existing) {
      res.status(400).json({ success: false, error: "你已申请过该活动" });
      return;
    }

    // 复用已退出/被拒绝的旧记录，或创建新记录（避免唯一索引冲突）
    const exited = await EventParticipant.findOne({
      eventId,
      userId,
      status: { $in: [ParticipantStatus.EXITED, ParticipantStatus.REJECTED] },
    });
    if (exited) {
      exited.status = ParticipantStatus.APPLIED;
      exited.appliedAt = new Date();
      exited.respondedAt = null;
      exited.exitedAt = null;
      await exited.save();
    } else {
      await EventParticipant.create({
        eventId,
        userId,
        role: "participant",
        status: ParticipantStatus.APPLIED,
      });
    }

    // 通知发布者
    await createNotification({
      userId: event.hostId,
      type: NotificationType.EVENT_APPLICATION,
      referenceId: event._id,
      title: "新的活动申请",
      body: `${req.user!.email} 申请加入你的活动`,
    });

    // Socket 通知
    const io = getIO();
    const applier = await User.findById(userId).select("nickname avatar userId");
    io.to(`user:${event.hostId.toString()}`).emit("new_application", {
      eventId: event._id.toString(),
      applicant: {
        userId: userId.toString(),
        numericId: req.user!.numericId,
        nickname: applier?.nickname || "",
        avatar: applier?.avatar || "",
      },
    });

    res.json({ success: true, message: "申请已发送" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/v1/events/:id/stop-recruiting
 * 停止招募（仅发布者）
 */
export async function stopRecruiting(req: AuthRequest, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, error: "活动不存在" });
      return;
    }
    if (event.hostId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, error: "仅发布者可操作" });
      return;
    }
    if (!canTransitionActivity(event.status, ActivityStatus.WAITING)) {
      res.status(400).json({ success: false, error: "当前状态不允许此操作" });
      return;
    }

    event.status = ActivityStatus.WAITING;
    await event.save();

    const io = getIO();
    io.to(`event:${event._id.toString()}`).emit("event_status_changed", {
      eventId: event._id.toString(),
      newStatus: ActivityStatus.WAITING,
      oldStatus: ActivityStatus.RECRUITING,
    });

    res.json({ success: true, message: "已停止招募" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/v1/events/:id/cancel
 * 取消活动（仅发布者）
 */
export async function cancelEvent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, error: "活动不存在" });
      return;
    }
    if (event.hostId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, error: "仅发布者可操作" });
      return;
    }

    event.status = ActivityStatus.CANCELLED;
    await event.save();

    // 通知所有参与者
    const participants = await EventParticipant.find({ eventId: event._id });
    await createNotificationsForMany(
      participants.map((p) => p.userId),
      { type: NotificationType.EVENT_STATUS_CHANGE, referenceId: event._id, title: "活动已取消", body: "发布者已取消该活动" }
    );

    const io = getIO();
    io.to(`event:${event._id.toString()}`).emit("event_status_changed", {
      eventId: event._id.toString(),
      newStatus: ActivityStatus.CANCELLED,
      oldStatus: event.status,
    });

    res.json({ success: true, message: "活动已取消" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * POST /api/v1/events/:id/exit
 * 退出活动（仅参与者）
 */
export async function exitEvent(req: AuthRequest, res: Response): Promise<void> {
  try {
    const participant = await EventParticipant.findOne({
      eventId: req.params.id,
      userId: req.user!.userId,
    });

    if (!participant || participant.role === "host") {
      res.status(400).json({ success: false, error: "无法退出活动" });
      return;
    }

    if (!canTransitionParticipant(participant.status, ParticipantStatus.EXITED)) {
      res.status(400).json({ success: false, error: "当前状态不允许退出" });
      return;
    }

    const wasApplied = participant.status === ParticipantStatus.APPLIED;
    const wasAccepted = participant.status === ParticipantStatus.ACCEPTED;

    participant.status = ParticipantStatus.EXITED;
    participant.exitedAt = new Date();
    await participant.save();

    // 如果是取消申请（申请阶段退出），删除发给发布者的申请通知
    if (wasApplied) {
      const event = await Event.findById(req.params.id).select("hostId");
      if (event) {
        await Notification.deleteOne({
          userId: event.hostId,
          type: NotificationType.EVENT_APPLICATION,
          referenceId: req.params.id,
          body: { $regex: new RegExp(req.user!.email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        });
      }
    }

    // 仅从"已接受"退出时才需要减少人数和统计（申请阶段未增加过）
    if (wasAccepted) {
      await Event.findByIdAndUpdate(req.params.id, { $inc: { currentParticipants: -1 } });
      await User.findByIdAndUpdate(req.user!.userId, { $inc: { "stats.participatedEvents": -1 } });
    }

    // 从群聊移除
    const redis = getRedis();
    await redis.srem(`group_chat:${req.params.id}`, req.user!.userId.toString());

    res.json({ success: true, message: "已退出活动" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function acceptApplication(req: AuthRequest, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.hostId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, error: "仅发布者可操作" }); return;
    }
    const participant = await EventParticipant.findOne({
      eventId: req.params.id, userId: req.params.userId, status: ParticipantStatus.APPLIED,
    });
    if (!participant) { res.status(404).json({ success: false, error: "申请不存在" }); return; }
    participant.status = ParticipantStatus.ACCEPTED;
    participant.respondedAt = new Date();
    await participant.save();
    await Event.findByIdAndUpdate(req.params.id, { $inc: { currentParticipants: 1 } });
    await User.findByIdAndUpdate(req.params.userId, { $inc: { "stats.participatedEvents": 1 } });
    const redis = getRedis();
    await redis.sadd(`group_chat:${req.params.id}`, req.params.userId);
    await createNotification({
      userId: req.params.userId, type: NotificationType.EVENT_ACCEPTED,
      referenceId: event._id, title: "申请通过", body: "你的活动申请已被通过",
    });
    const io = getIO();
    io.to(`user:${req.params.userId}`).emit("application_result", {
      eventId: event._id.toString(), status: "accepted",
    });
    res.json({ success: true, message: "已通过申请" });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function rejectApplication(req: AuthRequest, res: Response): Promise<void> {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || event.hostId.toString() !== req.user!.userId) {
      res.status(403).json({ success: false, error: "仅发布者可操作" }); return;
    }
    const participant = await EventParticipant.findOne({
      eventId: req.params.id, userId: req.params.userId, status: ParticipantStatus.APPLIED,
    });
    if (!participant) { res.status(404).json({ success: false, error: "申请不存在" }); return; }
    participant.status = ParticipantStatus.REJECTED;
    participant.respondedAt = new Date();
    await participant.save();
    await createNotification({
      userId: req.params.userId, type: NotificationType.EVENT_REJECTED,
      referenceId: event._id, title: "申请未通过", body: "你的活动申请未被通过",
    });
    // Socket 通知被拒者
    const io = getIO();
    io.to(`user:${req.params.userId}`).emit("application_result", {
      eventId: event._id.toString(), status: "rejected",
    });
    res.json({ success: true, message: "已拒绝申请" });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}
