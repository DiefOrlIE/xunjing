import crypto from "crypto";
import { logger } from "./logger";

/**
 * 聊天内容静态加密（AES-256-GCM）
 *
 * 设计目标：只加密数据库里存的聊天正文，接口/前端拿到的仍是明文，做到「透明加解密」。
 * - 密钥从环境变量 CHAT_ENC_KEY 读（32 字节，64 位 hex 或 base64），绝不硬编码。
 * - 未配置密钥时 = 直通模式（不加密，不报错），保证没配 key 也不会把聊天功能搞挂；
 *   配好 key 并重启后，新消息自动加密，历史明文照常可读（无需迁移）。
 * - 密文带前缀 `enc:v1:`，解密只处理带前缀的串；明文原样返回，因此加/解密都幂等。
 *
 * 密钥懒加载：index.ts 顶部 dotenv.config() 会晚于本模块被 import（ES import 提升），
 * 若在模块加载期读 env 会永远读不到 .env 里的 key。故首次调用时才解析并缓存。
 */

const PREFIX = "enc:v1:";

// undefined = 尚未解析；null = 已解析且无 key（直通）；Buffer = 已解析的密钥
let cachedKey: Buffer | null | undefined = undefined;

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const RAW = process.env.CHAT_ENC_KEY || "";
  if (!RAW) {
    cachedKey = null;
    logger.warn("[加密] 未配置 CHAT_ENC_KEY，聊天内容以明文存储（直通模式）");
    return cachedKey;
  }
  const buf = /^[0-9a-fA-F]{64}$/.test(RAW) ? Buffer.from(RAW, "hex") : Buffer.from(RAW, "base64");
  if (buf.length !== 32) {
    // 配了 key 但格式错 → 直接抛，避免用坏 key 存出无法解密的垃圾数据
    throw new Error("CHAT_ENC_KEY 必须是 32 字节（64 位 hex 或 base64 编码）");
  }
  cachedKey = buf;
  logger.info("[加密] 聊天内容静态加密已启用（AES-256-GCM）");
  return cachedKey;
}

export const chatEncryptionEnabled = (): boolean => getKey() !== null;

export function isEncrypted(s: unknown): boolean {
  return typeof s === "string" && s.startsWith(PREFIX);
}

/** 加密聊天正文；未配 key、空串、或已加密则原样返回 */
export function encryptContent<T>(plain: T): T {
  const key = getKey();
  if (!key || plain == null || plain === "") return plain;
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (PREFIX + iv.toString("base64") + ":" + tag.toString("base64") + ":" + enc.toString("base64")) as unknown as T;
}

/** 解密聊天正文；未配 key、非密文、或解密失败则原样返回（避免异常把接口打挂） */
export function decryptContent<T>(s: T): T {
  const key = getKey();
  if (!key || !isEncrypted(s)) return s;
  try {
    const parts = (s as unknown as string).slice(PREFIX.length).split(":");
    if (parts.length !== 3) return s;
    const iv = Buffer.from(parts[0], "base64");
    const tag = Buffer.from(parts[1], "base64");
    const data = Buffer.from(parts[2], "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8") as unknown as T;
  } catch (e) {
    logger.error("[加密] 聊天内容解密失败，返回原值");
    return s;
  }
}
