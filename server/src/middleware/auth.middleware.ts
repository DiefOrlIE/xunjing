import { Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import { AuthRequest } from "../types";
import { User } from "../models/User";

/**
 * JWT 认证中间件
 * 从 Authorization: Bearer <token> 头中提取并验证 JWT
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ success: false, error: "未提供认证Token" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;

    const user = await User.findById(payload.userId).select("banned banReason bannedUntil");
    if (user?.banned) {
      if (user.bannedUntil && user.bannedUntil.getTime() <= Date.now()) {
        user.banned = false;
        user.banReason = "";
        user.bannedUntil = null;
        await user.save();
      } else {
        res.status(403).json({ success: false, error: `账号已被封禁${user.banReason ? "：" + user.banReason : ""}` });
        return;
      }
    }

    next();
  } catch (err) {
    res.status(401).json({ success: false, error: "Token无效或已过期" });
  }
}
