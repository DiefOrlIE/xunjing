import mongoose, { Document, Schema } from "mongoose";

export interface IEventReview extends Document {
  eventId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number; // 1-5
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const EventReviewSchema = new Schema<IEventReview>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

// 一人对一个活动只能有一条评价（可覆盖更新）
EventReviewSchema.index({ eventId: 1, userId: 1 }, { unique: true });
EventReviewSchema.index({ eventId: 1, createdAt: -1 });

export const EventReview = mongoose.model<IEventReview>("EventReview", EventReviewSchema);
