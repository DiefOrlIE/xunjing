import mongoose, { Document, Schema } from "mongoose";

export type ReportTargetType = "user" | "event";
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  targetType: ReportTargetType;
  targetId: mongoose.Types.ObjectId;
  reason: string;
  status: ReportStatus;
  adminNote: string;
  handledBy: mongoose.Types.ObjectId | null;
  handledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["user", "event"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, required: true, maxlength: 500 },
    status: { type: String, enum: ["pending", "resolved", "dismissed"], default: "pending" },
    adminNote: { type: String, default: "", maxlength: 500 },
    handledBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ targetType: 1, targetId: 1 });

export const Report = mongoose.model<IReport>("Report", ReportSchema);
