import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { AuthRequest } from "../types";
import { authMiddleware } from "../middleware/auth.middleware";
import { adminMiddleware } from "../middleware/admin.middleware";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

const storage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, "items"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
}).single("image");

/**
 * 生成缩略图（300px 宽，用于展柜卡片展示）
 * 缩略图命名为 thumb_<原文件名>
 */
async function generateThumbnail(filePath: string, thumbPath: string): Promise<void> {
  try {
    // 保留原始格式（PNG→PNG保透明, JPEG→JPEG），避免透明图变黑底
    const ext = path.extname(filePath).toLowerCase();
    const isPng = ext === ".png" || ext === ".webp" || ext === ".gif";
    await sharp(filePath)
      .resize(300, 300, { fit: "inside", withoutEnlargement: true })
      .toFormat(isPng ? "png" : "jpeg", isPng ? { compressionLevel: 9 } : { quality: 80 })
      .toFile(thumbPath);
  } catch (err) {
    // 格式不受支持时降级为直接复制原图
    await fs.promises.copyFile(filePath, thumbPath);
  }
}

export function uploadItemImage(req: AuthRequest, res: Response): void {
  upload(req as any, res as any, async (err: any) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ success: false, error: "文件不能超过10MB" });
      } else {
        res.status(400).json({ success: false, error: "上传失败" });
      }
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: "请选择图片文件" });
      return;
    }

    const url = `/uploads/items/${req.file.filename}`;
    const thumbFilename = `thumb_${req.file.filename}`;
    const thumbUrl = `/uploads/items/${thumbFilename}`;

    // 异步生成缩略图（不阻塞响应）
    const filePath = req.file.path;
    const thumbPath = path.join(path.dirname(filePath), thumbFilename);
    generateThumbnail(filePath, thumbPath); // fire-and-forget

    res.json({ success: true, data: { url, thumbnailUrl: thumbUrl } });
  });
}

// ── 记忆墙图片（登录用户即可，无需管理员）──
const memoryStorage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, "memories"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});
const memoryUpload = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
}).single("image");

export function uploadMemoryImage(req: AuthRequest, res: Response): void {
  memoryUpload(req as any, res as any, async (err: any) => {
    if (err) {
      res.status(400).json({ success: false, error: err.code === "LIMIT_FILE_SIZE" ? "文件不能超过10MB" : "上传失败" });
      return;
    }
    if (!req.file) { res.status(400).json({ success: false, error: "请选择图片" }); return; }
    const url = `/uploads/memories/${req.file.filename}`;
    res.json({ success: true, data: { url } });
  });
}

const avatarStorage = multer.diskStorage({
  destination: path.join(UPLOAD_DIR, "avatars"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `${uuidv4()}${ext}`);
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".png", ".jpg", ".jpeg", ".webp"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
}).single("avatar");

export function uploadAvatar(req: AuthRequest, res: Response): void {
  avatarUpload(req as any, res as any, async (err: any) => {
    if (err) { res.status(400).json({ success: false, error: "上传失败" }); return; }
    if (!req.file) { res.status(400).json({ success: false, error: "请选择图片" }); return; }
    const url = `/uploads/avatars/${req.file.filename}`;
    const { User } = await import("../models/User");
    await User.findByIdAndUpdate(req.user!.userId, { avatar: url });
    res.json({ success: true, data: { url } });
  });
}
