// ── 稀有度枚举 ──
export enum Rarity {
  LEGENDARY = "典藏",    // 紫色 - 最高级
  MYTHIC = "神秘",       // 彩虹 - 彩蛋级，爆率最低
  LIMITED = "限定",      // 红色 - 活动限定
  EPIC = "高端",         // 橙色 - 中高级
  RARE = "普通",         // 蓝色
  COMMON = "常见",       // 绿色
}

export const RARITY_ORDER: Rarity[] = [
  Rarity.LEGENDARY,
  Rarity.MYTHIC,
  Rarity.LIMITED,
  Rarity.EPIC,
  Rarity.RARE,
  Rarity.COMMON,
];

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.LEGENDARY]: "#9B59B6",
  [Rarity.MYTHIC]: "rainbow",
  [Rarity.LIMITED]: "#E74C3C",
  [Rarity.EPIC]: "#F39C12",
  [Rarity.RARE]: "#3498DB",
  [Rarity.COMMON]: "#27AE60",
};

// ── 普通宝箱掉落权重 ──
export const NORMAL_CHEST_DROP_WEIGHTS: Record<Rarity, number> = {
  [Rarity.LEGENDARY]: 4,
  [Rarity.MYTHIC]: 1.5,
  [Rarity.LIMITED]: 4,
  [Rarity.EPIC]: 12,
  [Rarity.RARE]: 30,
  [Rarity.COMMON]: 48.5,
};

// ── 高级多人宝箱掉落权重 ──
export const ADVANCED_CHEST_DROP_WEIGHTS: Record<Rarity, number> = {
  [Rarity.LEGENDARY]: 20,
  [Rarity.MYTHIC]: 10,
  [Rarity.LIMITED]: 20,
  [Rarity.EPIC]: 50,
  [Rarity.RARE]: 0,
  [Rarity.COMMON]: 0,
};

// ── 校区枚举 ──
export enum Campus {
  GULOU = "gulou",
  XIANLIN = "xianlin",
  SUZHOU = "suzhou",
}

export const CAMPUS_NAMES: Record<Campus, string> = {
  [Campus.GULOU]: "鼓楼校区",
  [Campus.XIANLIN]: "仙林校区",
  [Campus.SUZHOU]: "苏州校区",
};

// ── 校区中心坐标与边界 ──
export const CAMPUS_CENTERS: Record<Campus, { lat: number; lng: number }> = {
  [Campus.GULOU]: { lat: 32.0575, lng: 118.7750 },
  [Campus.XIANLIN]: { lat: 32.1170, lng: 118.9500 },
  [Campus.SUZHOU]: { lat: 31.3230, lng: 120.5230 },
};

// ── 用户角色 ──
export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

// ── 活动全局状态 ──
export enum ActivityStatus {
  RECRUITING = "recruiting",
  WAITING = "waiting",
  ONGOING = "ongoing",
  FINISHED = "finished",
  CANCELLED = "cancelled",
}

// ── 活动参与状态 ──
export enum ParticipantStatus {
  APPLIED = "applied",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  EXITED = "exited",
}

// ── 宝箱类型 ──
export enum ChestType {
  NORMAL = "normal",
  ADVANCED = "advanced",
}

// ── 宝箱状态 ──
export enum ChestStatus {
  ACTIVE = "active",
  OPENED = "opened",
  EXPIRED = "expired",
}

// ── 好友状态 ──
export enum FriendshipStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
}

// ── 对话类型 ──
export enum ConversationType {
  PRIVATE = "private",
  GROUP = "group",
}

// ── 消息内容类型 ──
export enum ContentType {
  TEXT = "text",
  EMOJI = "emoji",
}

// ── 通知类型 ──
export enum NotificationType {
  FRIEND_REQUEST = "friend_request",
  FRIEND_ACCEPTED = "friend_accepted",
  EVENT_APPLICATION = "event_application",
  EVENT_ACCEPTED = "event_accepted",
  EVENT_REJECTED = "event_rejected",
  EVENT_STATUS_CHANGE = "event_status_change",
  NEW_COLLECTION = "new_collection",
}

// ── 活动状态流转规则 ──
export const ALLOWED_ACTIVITY_TRANSITIONS: Record<ActivityStatus, ActivityStatus[]> = {
  [ActivityStatus.RECRUITING]: [ActivityStatus.WAITING, ActivityStatus.CANCELLED],
  [ActivityStatus.WAITING]: [ActivityStatus.ONGOING, ActivityStatus.CANCELLED],
  [ActivityStatus.ONGOING]: [ActivityStatus.FINISHED, ActivityStatus.CANCELLED],
  [ActivityStatus.FINISHED]: [],
  [ActivityStatus.CANCELLED]: [],
};

// ── 参与者状态流转规则 ──
export const ALLOWED_PARTICIPANT_TRANSITIONS: Record<ParticipantStatus, ParticipantStatus[]> = {
  [ParticipantStatus.APPLIED]: [ParticipantStatus.ACCEPTED, ParticipantStatus.REJECTED, ParticipantStatus.EXITED],
  [ParticipantStatus.ACCEPTED]: [ParticipantStatus.EXITED],
  [ParticipantStatus.REJECTED]: [],
  [ParticipantStatus.EXITED]: [],
};

// ── 管理员邮箱（从环境变量读取，模版占位） ──
export function getAdminEmails(): Set<string> {
  const emails = process.env.ADMIN_EMAILS || "";
  return new Set(
    emails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)
  );
}

// ── 宝箱刷新配置 ──
export const CHEST_CONFIG = {
  MAX_NORMAL_CHESTS_PER_CAMPUS: 3,
  ADVANCED_CHEST_SPAWN_CHANCE: 0.2,      // 每次刷新有20%概率生成高级宝箱
  CHEST_PROXIMITY_RADIUS_M: 20,           // 宝箱开启距离（米）
  CHEST_RESPAWN_INTERVAL_MIN: 30,         // 宝箱补充刷新间隔（分钟）
  CHEST_MAX_LIFETIME_HOURS: 6,            // 宝箱最长存活时间
  NORMAL_CHEST_COOLDOWN_HOURS: 1,         // 普通宝箱冷却
  ADVANCED_CHEST_COOLDOWN_HOURS: 1,       // 高级宝箱冷却（与普通宝箱相同）
};

// ── 活动配置 ──
export const EVENT_CONFIG = {
  CRON_INTERVAL_SECONDS: 60,              // 状态检查间隔
  GROUP_CHAT_READONLY_AFTER_HOURS: 24,    // 活动结束后多久群聊关闭并清理
};

// ── 允许的邮箱域名 ──
export function getAllowedEmailDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "smail.nju.edu.cn,nju.edu.cn")
    .split(",")
    .map((d) => d.trim().toLowerCase());
}
