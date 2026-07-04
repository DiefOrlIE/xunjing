import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { connectDatabase } from "./config/database";
import { getRedis } from "./config/redis";
import { initializeSocket } from "./socket";
import { startAllCronJobs } from "./cron";
import { initializeChests } from "./services/chest.service";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { logger } from "./utils/logger";

// ── 路由导入 ──
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import itemRoutes from "./routes/item.routes";
import chestRoutes from "./routes/chest.routes";
import noteRoutes from "./routes/note.routes";
import eventRoutes from "./routes/event.routes";
import eventTypeRoutes from "./routes/eventType.routes";
import friendRoutes from "./routes/friend.routes";
import chatRoutes from "./routes/chat.routes";
import notificationRoutes from "./routes/notification.routes";
import logRoutes from "./routes/log.routes";
import mapRoutes from "./routes/map.routes";
import adminRoutes from "./routes/admin.routes";
import uploadRoutes from "./routes/upload.routes";
import geoRoutes from "./routes/geo.routes";
import feedbackRoutes from "./routes/feedback.routes";
import { getUserCollections, deleteUserCollection } from "./controllers/item.controller";
import { authMiddleware } from "./middleware/auth.middleware";

const app = express();
const server = http.createServer(app);

// ── 基础中间件 ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 静态文件（上传的图片） ──
// UUID文件名 = 不可变资源，缓存365天，大幅提升展柜图片加载速度
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
app.use(
  "/uploads",
  express.static(path.resolve(uploadDir), {
    maxAge: "365d",
    immutable: true,
  })
);

// ── 健康检查 ──
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "校园社交与数字收藏 API 运行中",
    timestamp: new Date().toISOString(),
  });
});

// ── 版本号（改这里触发全端更新提示） ──
const APP_VERSION = "1.0.5";
app.get("/api/version", (_req, res) => {
  res.json({ success: true, version: APP_VERSION });
});

// ── APK 下载 ──
const apkPath = path.resolve("/var/www/seekwhale/app-release.apk");
app.get("/app-release.apk", (_req, res) => {
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.download(apkPath, "寻鲸.apk");
});

// ── API 路由 ──
app.use("/api/v1/auth", authRoutes);

// 用户藏品路由必须在 /user 之前注册（避免 /:userId 拦截）
app.get("/api/v1/user/collections", authMiddleware, getUserCollections);
app.delete("/api/v1/user/collections/:itemId", authMiddleware, deleteUserCollection);

app.use("/api/v1/user", userRoutes);
app.use("/api/v1/items", itemRoutes);
app.use("/api/v1/chests", chestRoutes);
app.use("/api/v1/notes", noteRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/event-types", eventTypeRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/log", logRoutes);
app.use("/api/v1/map", mapRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/upload", uploadRoutes);
app.use("/api/v1/geo", geoRoutes);
app.use("/api/v1/feedback", feedbackRoutes);

// ── 网页静态文件（挂到3000端口，供流量访问） ──
const webDir = path.resolve(__dirname, "../webdist");
app.use(express.static(webDir, { maxAge: "1h" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/uploads/") || req.path.startsWith("/socket.io/")) return next();
  if (req.method === "GET") res.sendFile(path.join(webDir, "index.html"));
  else next();
});

// ── 全局错误处理 ──
app.use(errorHandler);

// ── 启动服务 ──
const PORT = parseInt(process.env.PORT || "3000");

async function bootstrap(): Promise<void> {
  try {
    // 连接数据库
    await connectDatabase();

    // 连接 Redis
    const redis = getRedis();
    await redis.ping();
    logger.info("[Redis] 连接验证成功 (PONG)");

    // 初始化 Socket.IO
    initializeSocket(server);

    // 初始化宝箱（如果数据库为空）
    await initializeChests();

    // 启动定时任务
    startAllCronJobs();

    // 启动 HTTP 服务器
    server.listen(PORT, "0.0.0.0", () => {
      logger.info(`\n========================================`);
      logger.info(`  🏛️  校园社交与数字收藏 - 后端服务`);
      logger.info(`  📡 地址: http://localhost:${PORT}`);
      logger.info(`  🔌 WebSocket: ws://localhost:${PORT}`);
      logger.info(`  🌍 环境: ${process.env.NODE_ENV || "development"}`);
      logger.info(`========================================\n`);
    });
  } catch (error) {
    logger.error("启动失败:", error);
    process.exit(1);
  }
}

bootstrap();

export { app, server };
