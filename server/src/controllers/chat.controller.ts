import { Response } from "express";
import { AuthRequest } from "../types";
import { Message } from "../models/Message";
import { User } from "../models/User";
import { ConversationType, ContentType } from "../config/constants";
import { getPrivateConversationId, getGroupConversationId } from "../utils/conversationId";
import { decryptContent } from "../utils/crypto";
import { getIO } from "../socket";

export async function getPrivateChatHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { friendId } = req.params as { friendId: string };
    const conversationId = getPrivateConversationId(req.user!.userId, friendId);
    const { before, limit = "30" } = req.query;

    const query: any = { conversationId, conversationType: ConversationType.PRIVATE };
    if (before) query.createdAt = { $lt: new Date(before as string) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(+limit)
      .lean();

    const { User } = await import("../models/User");
    const senderIds = [...new Set(messages.map((m: any) => m.senderId).filter(Boolean))];
    const senders = await User.find({ _id: { $in: senderIds } }).select("nickname avatar userId").lean();
    const senderMap: Record<string, any> = {};
    senders.forEach((s: any) => { senderMap[s._id.toString()] = s; });

    res.json({ success: true, data: {
      messages: messages.reverse().map((m: any) => {
        const sid = typeof m.senderId === "string" ? m.senderId : m.senderId?.toString() || "";
        const s = senderMap[sid];
        return {
          _id: m._id,
          senderId: sid,
          senderNickname: s?.nickname || "用户",
          senderAvatar: s?.avatar || "",
          content: decryptContent(m.content),
          contentType: m.contentType,
          isRevoked: m.isRevoked || false,
          createdAt: m.createdAt,
        };
      }),
      conversationId,
    }});
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function sendPrivateMessageREST(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { friendId } = req.params as { friendId: string };
    const { content, contentType } = req.body;
    const conversationId = getPrivateConversationId(req.user!.userId, friendId);
    const sender = await User.findById(req.user!.userId).select("nickname avatar userId");
    const message = await Message.create({
      conversationType: ConversationType.PRIVATE, conversationId,
      senderId: req.user!.userId,
      contentType: contentType || ContentType.TEXT, content,
      readBy: [req.user!.userId],
    });
    res.status(201).json({ success: true, data: {
      senderId: req.user!.userId,
      senderNickname: sender?.nickname || "用户",
      senderAvatar: sender?.avatar || "",
      content, contentType: contentType || ContentType.TEXT,
      createdAt: message.createdAt.toISOString(),
    }});
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function sendGroupMessageREST(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { eventId } = req.params as { eventId: string };
    const { content, contentType } = req.body;
    const conversationId = getGroupConversationId(eventId);
    const message = await Message.create({
      conversationType: ConversationType.GROUP, conversationId,
      senderId: req.user!.userId,
      contentType: contentType || ContentType.TEXT, content,
      readBy: [req.user!.userId],
    });
    res.status(201).json({ success: true, data: {
      senderId: req.user!.userId,
      content, contentType: contentType || ContentType.TEXT,
      createdAt: message.createdAt.toISOString(),
    }});
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
}

export async function getGroupChatHistory(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { eventId } = req.params as { eventId: string };
    const conversationId = getGroupConversationId(eventId);
    const { before, limit = "30" } = req.query;

    const query: any = { conversationId, conversationType: ConversationType.GROUP };
    if (before) query.createdAt = { $lt: new Date(before as string) };

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(+limit)
      .lean();

    // senderId存的是字符串非ObjectId，手动查用户
    const { User } = await import("../models/User");
    const senderIds = [...new Set(messages.map((m: any) => m.senderId).filter(Boolean))];
    const senders = await User.find({ _id: { $in: senderIds } }).select("nickname avatar userId").lean();
    const senderMap: Record<string, any> = {};
    senders.forEach((s: any) => { senderMap[s._id.toString()] = s; });

    res.json({ success: true, data: {
      messages: messages.reverse().map((m: any) => {
        const sid = typeof m.senderId === "string" ? m.senderId : m.senderId?.toString() || "";
        const s = senderMap[sid];
        return {
          _id: m._id,
          senderId: sid,
          senderNickname: s?.nickname || "用户",
          senderAvatar: s?.avatar || "",
          content: decryptContent(m.content),
          contentType: m.contentType,
          isRevoked: m.isRevoked || false,
          createdAt: m.createdAt,
        };
      }),
      conversationId,
    }});
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** 撤回消息（仅发送者，1分钟内） */
export async function revokeMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) { res.status(404).json({ success: false, error: "消息不存在" }); return; }
    if (message.senderId.toString() !== req.user!.userId.toString()) {
      res.status(403).json({ success: false, error: "只能撤回自己的消息" }); return;
    }
    const elapsed = Date.now() - new Date(message.createdAt).getTime();
    if (elapsed > 1 * 60 * 1000) {
      res.status(400).json({ success: false, error: "超过1分钟无法撤回" }); return;
    }
    message.isRevoked = true;
    await message.save();

    // Socket 实时通知对方
    const io = getIO();
    if (io) {
      const eventPayload = { messageId, conversationId: message.conversationId };
      if (message.conversationType === ConversationType.PRIVATE) {
        const parts = message.conversationId.split("_");
        parts.forEach((uid) => io.to(`user:${uid}`).emit("message_revoked", eventPayload));
      } else {
        const eventId = message.conversationId.replace("event_", "");
        io.to(`event:${eventId}`).emit("message_revoked", eventPayload);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}

/** 删除消息（允许删除对话内任何人消息，硬删除） */
export async function deleteMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { messageId } = req.params;
    const message = await Message.findById(messageId);
    if (!message) { res.status(404).json({ success: false, error: "消息不存在" }); return; }
    const conversationId = message.conversationId;
    await message.deleteOne();

    // Socket 实时通知对方
    const io = getIO();
    if (io) {
      const eventPayload = { messageId, conversationId };
      if (message.conversationType === ConversationType.PRIVATE) {
        const parts = conversationId.split("_");
        parts.forEach((uid) => io.to(`user:${uid}`).emit("message_deleted", eventPayload));
      } else {
        const eventId = conversationId.replace("event_", "");
        io.to(`event:${eventId}`).emit("message_deleted", eventPayload);
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
