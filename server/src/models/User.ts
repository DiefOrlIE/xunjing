import mongoose, { Document, Schema } from "mongoose";
import { UserRole } from "../config/constants";

export interface IUser extends Document {
  email: string;
  nickname: string;
  userId: number;
  avatar: string;
  role: UserRole;
  stats: {
    totalCollections: number;
    hostedEvents: number;
    participatedEvents: number;
  };
  banned: boolean;
  banReason: string;
  bannedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    nickname: { type: String, default: "", maxlength: 20 },
    studentId: { type: String, default: "", maxlength: 20 },
    userId: { type: Number, required: true, unique: true },
    avatar: { type: String, default: "" },
    password: { type: String, default: "" },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
    stats: {
      totalCollections: { type: Number, default: 0 },
      hostedEvents: { type: Number, default: 0 },
      participatedEvents: { type: Number, default: 0 },
    },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: "" },
    bannedUntil: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userId: 1 }, { unique: true });
UserSchema.index({ role: 1 });

export const User = mongoose.model<IUser>("User", UserSchema);
