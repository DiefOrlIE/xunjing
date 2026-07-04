import { Response } from "express";
import { AuthRequest } from "../types";
import { User } from "../models/User";
import { Friendship } from "../models/Friendship";
import { Message } from "../models/Message";
import { decryptContent } from "../utils/crypto";
import { FriendshipStatus, NotificationType } from "../config/constants";
import { createNotification } from "../services/notification.service";
import { getIO } from "../socket";
import mongoose from "mongoose";

export async function getFriendList(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.userId;
    const friendships = await Friendship.find({
      $or: [{ userId }, { friendId: userId }],
      status: FriendshipStatus.ACCEPTED,
    });

    const friendIds = friendships.map((f) =>
      f.userId.toString() === userId.toString() ? f.friendId : f.userId
    );

    const friends = await User.find({ _id: { $in: friendIds } }).select("nickname avatar userId");

    // 获取最近消息
    const friendsWithMessages = await Promise.all(
      friends.map(async (friend) => {
        const convId = [userId.toString(), friend._id.toString()].sort().join("_");
        const lastMsg = await Message.findOne({ conversationId: convId })
          .sort({ createdAt: -1 })
          .select("content createdAt");
        return {
          id: friend._id,
          userId: friend.userId,
          nickname: friend.nickname,
          avatar: friend.avatar,
          lastMessage: decryptContent(lastMsg?.content) || "",
          lastMessageTime: lastMsg?.createdAt || null,
        };
      })
    );

    friendsWithMessages.sort((a, b) => {
      if (!a.lastMessageTime && !b.lastMessageTime) return a.nickname.localeCompare(b.nickname);
      if (!a.lastMessageTime) return 1;
      if (!b.lastMessageTime) return -1;
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    });

    res.json({ success: true, data: friendsWithMessages });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function sendFriendRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { targetUserId } = req.body;
    const target = await User.findOne({ userId: targetUserId });
    if (!target) { res.status(404).json({ success: false, error: "未查找到该用户" }); return; }
    if (target._id.toString() === req.user!.userId.toString()) {
      res.status(400).json({ success: false, error: "不能添加自己为好友" });
      return;
    }

    const existing = await Friendship.findOne({
      $or: [
        { userId: req.user!.userId, friendId: target._id },
        { userId: target._id, friendId: req.user!.userId },
      ],
    });
    if (existing) {
      if (existing.status === FriendshipStatus.ACCEPTED) {
        res.status(400).json({ success: false, error: "已是好友" });
      } else if (existing.userId.toString() === req.user!.userId.toString()) {
        res.status(400).json({ success: false, error: "已发送申请，等待验证" });
      } else {
        res.status(400).json({ success: false, error: "对方已向你发送申请" });
      }
      return;
    }

    const friendship = await Friendship.create({
      userId: req.user!.userId,
      friendId: target._id,
      status: FriendshipStatus.PENDING,
    });

    await createNotification({
      userId: target._id,
      type: NotificationType.FRIEND_REQUEST,
      referenceId: friendship._id,
      title: "新的好友申请",
      body: `${req.user!.email} 请求添加你为好友`,
    });

    const io = getIO();
    const sender = await User.findById(req.user!.userId).select("nickname avatar userId");
    io.to(`user:${target._id.toString()}`).emit("friend_request_received", {
      requestId: friendship._id.toString(),
      fromUser: {
        userId: req.user!.userId.toString(),
        numericId: req.user!.numericId,
        nickname: sender?.nickname || "",
        avatar: sender?.avatar || "",
      },
    });

    res.json({ success: true, message: "好友申请已发送" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function getFriendRequests(req: AuthRequest, res: Response): Promise<void> {
  try {
    const requests = await Friendship.find({
      friendId: req.user!.userId,
      status: FriendshipStatus.PENDING,
    }).populate("userId", "nickname avatar userId");

    res.json({ success: true, data: requests });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function acceptFriendRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship || friendship.friendId.toString() !== req.user!.userId.toString()) {
      res.status(404).json({ success: false, error: "申请不存在" });
      return;
    }

    friendship.status = FriendshipStatus.ACCEPTED;
    await friendship.save();

    await createNotification({
      userId: friendship.userId,
      type: NotificationType.FRIEND_ACCEPTED,
      title: "好友申请通过",
      body: "对方已同意你的好友申请",
    });

    const io = getIO();
    const friend = await User.findById(req.user!.userId).select("nickname avatar userId");
    io.to(`user:${friendship.userId.toString()}`).emit("friend_request_accepted", {
      friendId: req.user!.userId.toString(),
      friendInfo: {
        userId: req.user!.userId.toString(),
        numericId: req.user!.numericId,
        nickname: friend?.nickname || "",
        avatar: friend?.avatar || "",
      },
    });

    res.json({ success: true, message: "已同意好友申请" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function rejectFriendRequest(req: AuthRequest, res: Response): Promise<void> {
  try {
    const friendship = await Friendship.findById(req.params.id);
    if (!friendship || friendship.friendId.toString() !== req.user!.userId.toString()) {
      res.status(404).json({ success: false, error: "申请不存在" });
      return;
    }
    friendship.status = FriendshipStatus.REJECTED;
    await friendship.save();
    res.json({ success: true, message: "已婉拒好友申请" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
