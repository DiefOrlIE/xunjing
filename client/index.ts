// Web Alert polyfill — 必须在所有组件之前执行
import { Alert, Platform } from "react-native";
if (Platform.OS === "web") {
  const orig = Alert.alert.bind(Alert);
  Alert.alert = ((title: string, message?: string, buttons?: any[]) => {
    if (!buttons || buttons.length <= 1) {
      window.alert(`${title || ""}\n${message || ""}`);
      buttons?.[0]?.onPress?.();
      return;
    }
    const labels = buttons.map((b: any) => b.text).join(" / ");
    const ok = window.confirm(`${title}\n\n${message || ""}\n\n选择: ${labels}`);
    (ok ? buttons.find((b: any) => b.style !== "cancel") || buttons[buttons.length - 1] : buttons.find((b: any) => b.style === "cancel") || buttons[0])?.onPress?.();
  }) as any;
}

// 航海志字体（仅 Web 运行时注入 Google Fonts；与 MapScreen 动态插 Leaflet CSS 同款做法）
if (Platform.OS === "web" && typeof document !== "undefined") {
  const FONT_HREF =
    "https://fonts.googleapis.com/css2?family=Long+Cang&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap";
  if (!document.querySelector("link[data-whale-fonts]")) {
    const pre1 = document.createElement("link"); pre1.rel = "preconnect"; pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link"); pre2.rel = "preconnect"; pre2.href = "https://fonts.gstatic.com"; pre2.crossOrigin = "anonymous";
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = FONT_HREF; link.setAttribute("data-whale-fonts", "");
    // 楷体（正文用）：霞鹜文楷 LXGW WenKai
    const kai = document.createElement("link"); kai.rel = "stylesheet"; kai.href = "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css";
    document.head.appendChild(pre1); document.head.appendChild(pre2); document.head.appendChild(link); document.head.appendChild(kai);
  }
}

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
