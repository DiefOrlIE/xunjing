// 🎨 寻鲸「航海志」配色 · 浅滩（shallows）
// 海洋蓝为主 + 薄荷/珊瑚点缀，清新冷色；保留旧 key 名以便全 App 平滑换肤。

export const colors = {
  // ── 主色调（海洋蓝）──
  primary: "#2C82C9",       // 海洋蓝 - 主品牌色（原珊瑚粉）
  primaryLight: "#5BA3DC",  // 浅海蓝
  primaryDark: "#235F96",   // 深海蓝

  // ── 辅助色 ──
  secondary: "#45C0A6",     // 薄荷绿（原阳光黄）
  accent: "#F97A66",        // 珊瑚（原清新绿）— 强调/CTA 点缀
  accentLight: "#FBC9BD",   // 浅珊瑚

  // ── 背景色 ──
  background: "#F2F7FB",    // 浅滩纸（主背景）
  surface: "#FFFFFF",       // 卡片/表面白
  surfaceAlt: "#E9F1F8",    // 冷调替代背景

  // ── 文字色 ──
  textPrimary: "#213F58",   // 深墨蓝（不是纯黑）
  textSecondary: "#5E7689", // 海雾灰蓝
  textHint: "#A6B6C2",      // 提示灰
  textOnPrimary: "#FFFFFF", // 主色上的文字

  // ── 稀有度配色（真实 6 级，浅滩调）──
  rarity: {
    典藏: "#6C63D6",  // 靛紫 Legendary
    神秘: "#C75BB8",  // 洋红 Mythic
    限定: "#F97A66",  // 珊瑚 Limited
    高端: "#E9B23F",  // 金 Epic
    普通: "#2C82C9",  // 海蓝 Rare
    常见: "#45C0A6",  // 薄荷 Common
  },

  // ── 功能色 ──
  success: "#5BB98C",
  warning: "#E9B23F",
  error: "#E25563",
  info: "#2C82C9",

  // ── 边框和分割线 ──
  border: "#E6EEF4",
  divider: "#EDF3F8",

  // ── Tab栏 ──
  tabActive: "#2C82C9",
  tabInactive: "#A6B6C2",
  tabBackground: "#FFFFFF",

  // ── 航海志别名（供新版屏幕/whaleKit 使用；多为上面值的语义别名）──
  paper: "#F2F7FB",
  paper2: "#FBFDFF",
  card: "#FFFFFF",
  grid: "#E2ECF4",
  line: "#E6EEF4",
  ink: "#213F58",
  sub: "#5E7689",
  faded: "#A6B6C2",
  green: "#5BB98C",
  gold: "#E9B23F",
  headerBg: "#235F96",
  headerInk: "#EAF4FC",
};

// 稀有度渐变色（神秘用多色冷调横扫模拟「神话」感）
export const rarityGradients = {
  典藏: ["#6C63D6", "#9B93E6"],
  神秘: ["#C75BB8", "#6C63D6", "#45C0A6"],
  限定: ["#F97A66", "#FBA08F"],
  高端: ["#E9B23F", "#F3C868"],
  普通: ["#2C82C9", "#5BA3DC"],
  常见: ["#45C0A6", "#7AD4BF"],
};
