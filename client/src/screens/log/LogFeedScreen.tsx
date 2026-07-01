import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { EmptyState } from "../../components/EmptyState";
import { RARITY_COLORS, ACTIVITY_STATUS_LABELS, PARTICIPANT_STATUS_LABELS } from "../../utils/constants";
import { getFeed } from "../../services/log.api";
import { FeedItem } from "../../types";

export function LogFeedScreen({ navigation }: any) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async () => {
    try {
      const res = await getFeed();
      if (res.success && res.data) setFeed(res.data.feed);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { fetchFeed(); }, [fetchFeed]));

  const onRefresh = () => { setRefreshing(true); fetchFeed(); };

  const renderItem = ({ item }: { item: FeedItem }) => {
    if (item.type === "collection") {
      const d = item.data;
      const rarity = d.itemDroppedRarity || "常见";
      const color = RARITY_COLORS[rarity] || "#999";
      return (
        <View style={[styles.card, styles.collectionCard, { borderLeftColor: color }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTime}>{new Date(item.timestamp).toLocaleDateString("zh-CN")} {new Date(item.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</Text>
          </View>
          <Text style={styles.collectionText}>
            获得了 <Text style={{ color, fontWeight: "700" }}>{rarity}</Text> 藏品 "
            <Text style={{ fontWeight: "700" }}>{d.itemDroppedId?.name || "未知藏品"}</Text>"
          </Text>
        </View>
      );
    }

    // 活动记录
    if (item.type === "activity") {
      const d = item.data;
      const event = d.eventId || {};
      const pStatus = d.status; // 参与者的状态 (applied/accepted/rejected/exited)
      const isParticipant = d.role === "participant";
      // 参与者看自己的申请状态，发布者看活动状态
      const displayStatus = isParticipant ? (PARTICIPANT_STATUS_LABELS[pStatus] || pStatus) : (ACTIVITY_STATUS_LABELS[event.status] || event.status);
      const statusColor = pStatus === "accepted" ? colors.success : pStatus === "rejected" ? colors.error : pStatus === "applied" ? colors.warning : colors.info;
      return (
        <TouchableOpacity
          style={[styles.card, styles.activityCard]}
          onPress={() => navigation.navigate("EventDetail", { eventId: event._id })}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTime}>{new Date(item.timestamp).toLocaleDateString("zh-CN")}</Text>
            <Text style={[styles.statusBadge, { color: isParticipant ? statusColor : (event.status === "recruiting" ? colors.info : event.status === "finished" ? colors.success : event.status === "cancelled" ? colors.error : colors.warning) }]}>
              {displayStatus}
            </Text>
          </View>
          {event.typeId?.name && (
            <Text style={{ fontSize: 11, fontWeight: "700", color: event.typeId?.color || "#3498DB", marginBottom: 2 }}>{event.typeId.name}</Text>
          )}
          <Text style={styles.activityTitle}>{event.title || "默认主题"}</Text>
          <Text style={styles.activityRole}>角色：{d.role === "host" ? "👑 发布者" : "🤝 参与者"}</Text>
        </TouchableOpacity>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>航海日志</Text>
      </View>

      <FlatList
        data={feed}
        keyExtractor={(item, index) => `${item.type}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={feed.length === 0 ? styles.emptyList : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={<EmptyState emoji="📖" title="还没有活动记录" subtitle="发布或参与活动后，这里会显示动态" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  header: {
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface, borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 6, zIndex: 10,
  },
  headerTitle: { fontFamily: HAND, fontSize: 24, color: colors.ink },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  emptyList: { flex: 1 },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    marginBottom: spacing.md, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  collectionCard: { borderLeftWidth: 4 },
  activityCard: {},
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  cardTime: { ...typography.caption, color: colors.textHint },
  statusBadge: { ...typography.caption, fontWeight: "700" },
  collectionText: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  activityTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.xs },
  activityRole: { ...typography.caption, color: colors.textSecondary },
});
