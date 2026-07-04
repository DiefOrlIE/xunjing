// ── 用户 ──
export interface UserProfile {
  id: string;
  userId: number;
  email: string;
  nickname: string;
  avatar: string;
  role: "user" | "admin";
  stats: UserStats;
}

export interface UserStats {
  totalCollections: number;
  hostedEvents: number;
  participatedEvents: number;
  successRate?: number | null;
}

export interface PublicUser {
  id: string;
  userId: number;
  nickname: string;
  avatar: string;
  stats: UserStats;
}

// ── 藏品 ──
export type Rarity = "典藏" | "神秘" | "限定" | "高端" | "普通" | "常见";

export interface CollectionItem {
  collectionId: string;
  itemId: string;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  rarity: Rarity;
  description?: string;
  count: number;
  acquiredAt: string;
  lastAcquiredAt: string;
}

export interface ItemDetail {
  _id: string;
  name: string;
  description: string;
  rarity: Rarity;
  imageUrl: string;
  dropWeight: number;
  isActive: boolean;
}

// ── 宝箱 ──
export interface ChestData {
  _id: string;
  campus: "gulou" | "xianlin" | "suzhou";
  type: "normal" | "advanced";
  coordinates: { lat: number; lng: number };
  requiredPlayers: number;
  expiresAt: string;
}

// ── 纸条 ──
export interface NoteData {
  _id: string;
  campus: string;
  coordinates: { lat: number; lng: number };
  authorNickname: string;
  authorAvatar?: string;
  authorNumericId?: number;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  expiresAt: string;
  pickedAt?: string;
}

export interface ChestOpenResult {
  chestId: string;
  success: boolean;
  error?: string;
  item?: {
    id: string;
    name: string;
    rarity: Rarity;
    imageUrl: string;
  };
}

// ── 活动 ──
export type ActivityStatus = "recruiting" | "waiting" | "ongoing" | "finished" | "cancelled";
export type ParticipantStatus = "applied" | "accepted" | "rejected" | "exited";

export interface EventData {
  _id: string;
  hostId: any;
  typeId: any;
  title: string;
  startTime: string;
  endTime: string;
  capacity: number;
  campus: "gulou" | "xianlin" | "suzhou";
  locationText: string;
  meetCoordinates: { lat: number; lng: number };
  description: string;
  status: ActivityStatus;
  currentParticipants: number;
}

export interface EventTypeData {
  _id: string;
  name: string;
  iconUrl: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
}

// ── 好友 ──
export interface FriendData {
  id: string;
  userId: number;
  nickname: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: string | null;
}

export interface FriendRequest {
  _id: string;
  userId: PublicUser;
  friendId: string;
  status: "pending";
  createdAt: string;
}

// ── 消息 ──
export interface MessageData {
  _id?: string;
  conversationId?: string;
  senderId: string;
  senderNickname: string;
  senderAvatar: string;
  content: string;
  contentType: "text" | "emoji";
  isRevoked?: boolean;
  createdAt: string;
}

// ── 通知 ──
export interface NotificationData {
  _id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  referenceId: string | null;
  createdAt: string;
}

// ── 日志 ──
export interface FeedItem {
  type: "activity" | "collection";
  timestamp: string;
  data: any;
}

// ── API响应 ──
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
