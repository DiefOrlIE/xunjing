import { TextStyle } from "react-native";

// 航海志字体族（Web 端由 index.ts 运行时注入 Google Fonts；APK 阶段再走 expo-font 打包）
// 纪律：手写体(HAND)只用于标题/装饰，正文/按钮/表单一律用 BODY，避免可读性与跨端渲染问题。
export const HAND = "Long Cang, Noto Serif SC, serif";   // 手写（标题/落款）；缺字回退宋体而非黑体
export const SERIF = "Cormorant Garamond, Noto Serif SC"; // 衬线（en 副标/票根 Cartouche）
export const BODY = "Noto Sans SC";                    // 正文/按钮/标签
export const KAI = "LXGW WenKai, Kaiti SC, STKaiti, KaiTi, 楷体, Noto Serif SC, serif"; // 楷体（信笺正文）

export const typography: Record<string, TextStyle> = {
  h1: { fontSize: 28, fontWeight: "700", lineHeight: 36 },
  h2: { fontSize: 22, fontWeight: "700", lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: "600", lineHeight: 25 },
  body: { fontSize: 16, fontWeight: "400", lineHeight: 22 },
  bodyBold: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  small: { fontSize: 11, fontWeight: "400", lineHeight: 15 },
  button: { fontSize: 17, fontWeight: "600", lineHeight: 22 },
  tab: { fontSize: 11, fontWeight: "500", lineHeight: 14 },
};
