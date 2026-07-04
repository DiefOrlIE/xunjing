import { Response } from "express";
import { AuthRequest } from "../types";
import { User } from "../models/User";
import { UserCollection } from "../models/UserCollection";
import { EventParticipant } from "../models/EventParticipant";
import { Friendship } from "../models/Friendship";
import { Message } from "../models/Message";
import { Notification } from "../models/Notification";
import { ChestOpenLog } from "../models/ChestOpenLog";
import { Event } from "../models/Event";
import { ActivityStatus } from "../config/constants";

/**
 * GET /api/v1/user/:userId
 * 按数字ID查找用户（好友搜索）
 */
export async function getUserByNumericId(req: AuthRequest, res: Response): Promise<void> {
  try {
    const numericId = parseInt(req.params.userId as string);
    if (isNaN(numericId)) {
      res.status(400).json({ success: false, error: "无效的用户ID" });
      return;
    }

    const user = await User.findOne({ userId: numericId }).select("nickname avatar userId stats");

    if (!user) {
      res.status(404).json({ success: false, error: "未查找到该用户" });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        userId: user.userId,
        nickname: user.nickname,
        avatar: user.avatar,
        stats: user.stats,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * PUT /api/v1/user/profile
 * 更新昵称/头像
 */
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { nickname, avatar, studentId } = req.body;
    const update: any = {};

    if (nickname !== undefined) update.nickname = nickname;
    if (avatar !== undefined) update.avatar = avatar;
    if (studentId !== undefined) update.studentId = studentId;

    if (Object.keys(update).length === 0) {
      res.status(400).json({ success: false, error: "没有需要更新的字段" });
      return;
    }

    const user = await User.findByIdAndUpdate(req.user!.userId, update, { new: true }).select("nickname avatar userId email role stats");

    res.json({ success: true, data: user, message: "资料更新成功" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/v1/user/stats
 * 获取用户统计数据
 */
export async function getStats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    const user = await User.findById(userId).select("stats");
    if (!user) {
      res.status(404).json({ success: false, error: "用户不存在" });
      return;
    }

    // 从 UserCollection 实时计算藏品总数，确保与展柜一致
    const collections = await UserCollection.find({ userId, count: { $gt: 0 } });
    const totalCollections = collections.reduce((sum, c) => sum + c.count, 0);

    // 发起活动成功率：finished / (finished + cancelled)，尚未有结果的招募中/进行中活动不计入
    const [hostedFinished, hostedCancelled] = await Promise.all([
      Event.countDocuments({ hostId: userId, status: ActivityStatus.FINISHED }),
      Event.countDocuments({ hostId: userId, status: ActivityStatus.CANCELLED }),
    ]);
    const hostedTotal = hostedFinished + hostedCancelled;
    const successRate = hostedTotal > 0 ? Math.round((hostedFinished / hostedTotal) * 100) : null;

    res.json({
      success: true,
      data: {
        totalCollections,
        hostedEvents: user.stats.hostedEvents,
        participatedEvents: user.stats.participatedEvents,
        successRate,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * DELETE /api/v1/user/account
 * 注销账号
 */
export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;

    // 级联删除所有相关数据
    await Promise.all([
      User.findByIdAndDelete(userId),
      UserCollection.deleteMany({ userId }),
      EventParticipant.deleteMany({ userId }),
      Friendship.deleteMany({ $or: [{ userId }, { friendId: userId }] }),
      Message.deleteMany({ senderId: userId }),
      Notification.deleteMany({ userId }),
      ChestOpenLog.deleteMany({ userId }),
    ]);

    res.json({ success: true, message: "账号已注销，数据已清空" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
