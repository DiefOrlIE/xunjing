import mongoose, { Document, Schema } from "mongoose";

export interface IEventMemory extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  imageUrl: string; // 单张图片，可空
  createdAt: Date;
  updatedAt: Date;
}

const EventMemorySchema = new Schema<IEventMemory>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, default: "", maxlength: 1000 },
    imageUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

EventMemorySchema.index({ eventId: 1, createdAt: -1 });

export const EventMemory = mongoose.model<IEventMemory>("EventMemory", EventMemorySchema);
