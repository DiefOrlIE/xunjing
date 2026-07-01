// TEMP-PREVIEW 仅本地查看用：拦截 axios 返回假数据 + 塞假用户。验收后删除并撤掉 index.ts 的引用。
import api from "./services/api";
import { useAuthStore } from "./store/authStore";

const ok = (data: any) =>
  Promise.resolve({ data: { success: true, data }, status: 200, statusText: "OK", headers: {}, config: {} } as any);

const RARITIES = ["典藏", "神秘", "限定", "高端", "普通", "常见"];
const NAMES: Record<string, string[]> = {
  典藏: ["鼓楼晚樱"], 神秘: ["鲸歌"], 限定: ["北大楼", "仙林月色"],
  高端: ["梧桐叶", "银杏雨", "校车票"], 普通: ["图书馆卡", "梅园猫", "杜鹃"], 常见: ["香樟", "栀子", "蒲公英"],
};
let cid = 0;
const COLLECTIONS = RARITIES.flatMap((r) =>
  NAMES[r].map((name) => ({ collectionId: "c" + cid++, itemId: "i" + cid, name, imageUrl: "", thumbnailUrl: "", rarity: r, count: 1 + (cid % 5) }))
);

const TYPES = [
  { _id: "t1", name: "吃饭", color: "#F97A66", iconUrl: "" },
  { _id: "t2", name: "自习", color: "#2C82C9", iconUrl: "" },
  { _id: "t3", name: "运动", color: "#45C0A6", iconUrl: "" },
];
const mkEvent = (i: number, status: string) => ({
  _id: "e" + i, title: ["晚饭拼个桌", "图书馆肝期末", "夜跑仙林湖", "羽毛球搭子"][i % 4],
  typeId: TYPES[i % 3], status, locationText: ["仙林·第三食堂", "杜厦图书馆 3F", "仙林湖步道", "体育馆"][i % 4],
  capacity: 6, currentParticipants: 2 + (i % 4), startTime: new Date(Date.now() + i * 3600000).toISOString(),
});
const EVENTS = [mkEvent(0, "recruiting"), mkEvent(1, "ongoing"), mkEvent(2, "recruiting"), mkEvent(3, "waiting")];
const MY_EVENTS = [mkEvent(0, "recruiting"), mkEvent(4, "finished")];

const FRIENDS = [
  { id: "f1", userId: 1001, nickname: "陈芊静", avatar: null, lastMessage: "晚上图书馆见～" },
  { id: "f2", userId: 1002, nickname: "黄梓洋", avatar: null, lastMessage: "活动报名了" },
];

const CHESTS = [
  { _id: "ch1", type: "normal", coordinates: { lat: 32.1175, lng: 118.9520 } },
  { _id: "ch2", type: "advanced", coordinates: { lat: 32.1162, lng: 118.9548 }, requiredPlayers: 3 },
];

if (typeof window !== "undefined") {
  api.defaults.adapter = async (config: any) => {
    const u = String(config.url || "");
    if (/event[-_]?type|types/i.test(u)) return ok(TYPES);
    if (/events?.*(mine|my)|my.*events?/i.test(u)) return ok(MY_EVENTS);
    if (/events?/i.test(u)) return ok({ events: EVENTS, total: EVENTS.length });
    if (/collections?/i.test(u)) return ok({ collections: COLLECTIONS });
    if (/friend.*request|request/i.test(u)) return ok([]);
    if (/friend/i.test(u)) return ok(FRIENDS);
    if (/stats/i.test(u)) return ok({ totalCollections: COLLECTIONS.length, hostedEvents: 5, participatedEvents: 12 });
    if (/campus[-_]?bound/i.test(u)) return ok([]);
    if (/activity[-_]?pin/i.test(u)) return ok(EVENTS.map((e, i) => ({ ...e, meetCoordinates: { lat: 32.117 + i * 0.0008, lng: 118.953 + i * 0.0009 } })));
    if (/chest/i.test(u)) return ok(CHESTS);
    if (/note/i.test(u)) return ok([]);
    if (/feedback/i.test(u)) return ok([]);
    if (/me\b|auth/i.test(u)) return ok({ userId: 5201314, nickname: "鳟鱼", email: "zhunyu@smail.nju.edu.cn", role: "admin" });
    return ok([]);
  };

  // 假用户（船长证/个人页有数据）
  try {
    useAuthStore.getState().setUser({
      userId: 5201314, nickname: "鳟鱼", email: "zhunyu@smail.nju.edu.cn", role: "admin",
      avatar: null, stats: { totalCollections: COLLECTIONS.length, hostedEvents: 5, participatedEvents: 12 },
    } as any);
  } catch {}
}
