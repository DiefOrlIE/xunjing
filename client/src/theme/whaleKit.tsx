// 寻鲸「航海志」视觉母题工具箱（react-native-svg 版，Web+Native 通用）
// 对应 mockup 的 kit3，CSS 渐变/点阵在 RN 不存在 → 用 <Svg> Pattern 实现。
import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import Svg, { Path, Circle, Rect, Line, Defs, Pattern, Text as SvgText } from "react-native-svg";
import { colors } from "./colors";

/* ── 鲸标 ── */
export function WhaleMark({ size = 30, color = colors.primary, eye = "#fff" }: { size?: number; color?: string; eye?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path d="M3 18c0-4 4-6.5 9-6.5 5.5 0 9 2.4 10.2 5.6 1.2.1 2.6-.5 4-1.9-.4 2.6-1.6 4.1-3.4 4.7.2 2.8-1.7 4.6-4.6 5.2l1.2 2.6-3.2-1.7c-3 .7-7 .2-9.6-1.4C4 22.9 3 20.4 3 18Z" fill={color} />
      <Circle cx={8.6} cy={16.4} r={1} fill={eye} />
      <Path d="M12.5 10.6c-.7-2 .3-3.6 1.9-4.4" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/* ── 鲸歌波形（声呐母题）── */
export function Waveform({ w = 120, h = 16, color = colors.secondary, sw = 2, opacity = 1 }: { w?: number; h?: number; color?: string; sw?: number; opacity?: number }) {
  return (
    <Svg width={w} height={h} viewBox="0 0 120 16" preserveAspectRatio="none" opacity={opacity}>
      <Path
        d="M0 8 Q4 8 6 5 Q8 2 10 8 Q12 14 15 8 Q17 4 20 8 Q22 12 25 7 Q28 1 31 8 Q34 15 37 8 Q39 5 42 8 Q45 13 48 6 Q51 2 54 8 Q57 14 60 8 Q63 3 66 8 Q69 13 72 7 Q75 2 78 8 Q81 14 84 8 Q87 5 90 8 Q93 12 96 6 Q99 2 102 8 Q105 14 108 8 Q111 5 114 8 Q117 11 120 8"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/* ── 涟漪（频率/鲸落）── */
export function Ripple({ size = 46, color = colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Circle cx={23} cy={23} r={21} fill="none" stroke={color} strokeWidth={1} opacity={0.18} />
      <Circle cx={23} cy={23} r={14} fill="none" stroke={color} strokeWidth={1.2} opacity={0.32} />
      <Circle cx={23} cy={23} r={7.5} fill="none" stroke={color} strokeWidth={1.4} opacity={0.55} />
    </Svg>
  );
}

/* ── 频率条（靠近度，纯 View）── */
export function FreqBars({ n, total = 5, color = colors.accent, h = 13 }: { n: number; total?: number; color?: string; h?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: h, gap: 2.5 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ width: 3, height: ((i + 1) / total) * h, borderRadius: 2, backgroundColor: i < n ? color : "transparent", borderWidth: 1, borderColor: i < n ? color : "#bbb" }} />
      ))}
    </View>
  );
}

/* ── 船长证印章 ── */
export function Seal({ size = 58, color = colors.accent }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46" opacity={0.42}>
      <Circle cx={23} cy={23} r={20} fill="none" stroke={color} strokeWidth={1.4} />
      <Circle cx={23} cy={23} r={14.5} fill="none" stroke={color} strokeWidth={0.7} />
      <SvgText x={23} y={15} fontSize={6} textAnchor="middle" fill={color} fontWeight="700">寻鲸</SvgText>
      <SvgText x={23} y={26} fontSize={5} textAnchor="middle" fill={color}>CAPTAIN</SvgText>
      <SvgText x={23} y={34} fontSize={5} textAnchor="middle" fill={color}>2026</SvgText>
    </Svg>
  );
}

/* ── 和纸胶带（手帐，纯 View）── */
export function Tape({ color = colors.accent, style }: { color?: string; style?: ViewStyle }) {
  return <View style={[{ position: "absolute", width: 44, height: 15, backgroundColor: color, opacity: 0.42 }, style]} />;
}

/* ── 点阵纸背景（手帐 · 展柜）：绝对铺满父容器，父需 position:relative + 背景色 ── */
export function DotPaper({ color = colors.grid, gap = 16, r = 1.3 }: { color?: string; gap?: number; r?: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill as any} pointerEvents="none">
      <Defs>
        <Pattern id="whaleDot" width={gap} height={gap} patternUnits="userSpaceOnUse">
          <Circle cx={gap / 2} cy={gap / 2} r={r} fill={color} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#whaleDot)" />
    </Svg>
  );
}

/* ── 海图方格纸背景（其余页）── */
export function SeaPaper({ color = colors.grid, gap = 22 }: { color?: string; gap?: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill as any} pointerEvents="none">
      <Defs>
        <Pattern id="whaleGrid" width={gap} height={gap} patternUnits="userSpaceOnUse">
          <Line x1={0} y1={0} x2={gap} y2={0} stroke={color} strokeWidth={1} opacity={0.6} />
          <Line x1={0} y1={0} x2={0} y2={gap} stroke={color} strokeWidth={1} opacity={0.6} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#whaleGrid)" />
    </Svg>
  );
}
