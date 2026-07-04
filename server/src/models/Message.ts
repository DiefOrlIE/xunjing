import mongoose, { Document, Schema } from "mongoose";
import { ConversationType, ContentType } from "../config/constants";
import { encryptContent } from "../utils/crypto";

export interface IMessage extends Document {
  conversationType: ConversationType;
  conversationId: string;
  senderId: mongoose.Types.ObjectId;
  contentType: ContentType;
  content: string;
  readBy: mongoose.Types.ObjectId[];
  isRevoked: boolean;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationType: {
      type: String,
      enum: Object.values(ConversationType),
      required: true,
    },
    conversationId: { type: String, required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      default: ContentType.TEXT,
    },
    content: { type: String, required: true, maxlength: 2000 },
    readBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isRevoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1 });

// ── 聊天内容静态加密：存库前加密 ──
// 读取处统一显式调用 decryptContent（历史列表走 .lean()、好友页最近消息走 hydrated，
// 都在各自 controller 里解密），不依赖 post("init") 钩子。
// 说明：本仓库 Schema<IMessage extends Document> 是旧式写法，pre/post 钩子的重载类型在此
// 会误判（与 User.ts 等历史类型报错同源）。运行时用 tsx 无编译，此处仅对钩子注册做局部 as any。
(MessageSchema as any).pre("save", function (this: IMessage, next: (err?: Error) => void) {
  if (this.content) this.content = encryptContent(this.content);
  next();
});

export const Message = mongoose.model<IMessage>("Message", MessageSchema);
