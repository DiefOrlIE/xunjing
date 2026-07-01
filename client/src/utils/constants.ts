// 校区枚举
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

// 校区默认边界（服务器可动态覆盖，此处为兜底）
export const CAMPUS_BOUNDS: Record<Campus, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  [Campus.GULOU]: { minLat: 32.0550, maxLat: 32.0615, minLng: 118.7720, maxLng: 118.7805 },
  [Campus.XIANLIN]: { minLat: 32.1100, maxLat: 32.1220, minLng: 118.9450, maxLng: 118.9570 },
  [Campus.SUZHOU]: { minLat: 31.3160, maxLat: 31.3300, minLng: 120.5150, maxLng: 120.5310 },
};

// 稀有度颜色 — 单一来源：theme/colors 的 rarity（收敛重复，改一处全联动）
import { colors } from "../theme/colors";
export const RARITY_COLORS: Record<string, string> = colors.rarity;

// 活动状态中文名
export const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  recruiting: "招募中",
  waiting: "等待开始",
  ongoing: "进行中",
  finished: "圆满结束",
  cancelled: "已取消",
};

export const PARTICIPANT_STATUS_LABELS: Record<string, string> = {
  applied: "响应中",
  accepted: "响应通过",
  rejected: "响应未通过",
  exited: "已退出",
};
