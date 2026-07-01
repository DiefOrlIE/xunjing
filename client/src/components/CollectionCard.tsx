import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { colors, HAND, typography } from "../theme";
import { RARITY_COLORS } from "../utils/constants";
import { fixImageUrl } from "../services/api";
import { Tape } from "../theme/whaleKit";

interface CollectionCardProps {
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  rarity: string;
  count: number;
  onPress?: () => void;
  disabled?: boolean;
  rotate?: number;      // 微旋转（手帐拍立得感），由 Gallery 逐个传入
  tapeColor?: string;   // 和纸胶带颜色
}

export function CollectionCard({ name, imageUrl, thumbnailUrl, rarity, count, onPress, disabled, rotate = 0, tapeColor }: CollectionCardProps) {
  const rarityColor = RARITY_COLORS[rarity] || "#999";
  // 缩略图加载失败时降级为原图（兼容旧图片无缩略图）
  const [thumbFailed, setThumbFailed] = useState(false);
  const displayUrl = (!thumbFailed && thumbnailUrl) ? thumbnailUrl : imageUrl;

  const card = (
    <View style={[styles.card, { transform: [{ rotate: `${rotate}deg` }] }]}>
      {/* 和纸胶带 */}
      <Tape color={tapeColor || colors.secondary} style={{ top: -7, left: "50%", marginLeft: -22, transform: [{ rotate: "-4deg" }] }} />
      {/* 数量角标 */}
      <View style={[styles.countBadge, { backgroundColor: rarityColor }]}>
        <Text style={styles.countText}>×{count}</Text>
      </View>
      {/* 图片（拍立得相纸窗口） */}
      <View style={styles.imageWrap}>
        {displayUrl ? (
          <Image source={{ uri: fixImageUrl(displayUrl) }} style={styles.image} resizeMode="contain" onError={() => setThumbFailed(true)} />
        ) : (
          <Text style={styles.placeholder}>🐚</Text>
        )}
      </View>
      {/* 名称（手写） */}
      <Text style={styles.name} numberOfLines={1}>{name}</Text>
    </View>
  );

  if (onPress && !disabled) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>{card}</TouchableOpacity>;
  }
  return <View style={styles.touchable}>{card}</View>;
}

const styles = StyleSheet.create({
  touchable: { width: "31%", marginBottom: 14 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
    paddingHorizontal: 5,
    paddingTop: 8,
    paddingBottom: 7,
    alignItems: "center",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 3,
  },
  countBadge: { position: "absolute", top: 4, right: 5, zIndex: 2, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999 },
  countText: { fontSize: 9, fontWeight: "800", color: "#FFF" },
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  image: { width: "82%", height: "82%" },
  placeholder: { fontSize: 32 },
  name: { ...typography.small, fontFamily: HAND, fontSize: 14, color: colors.ink, textAlign: "center", marginTop: 3 },
});
