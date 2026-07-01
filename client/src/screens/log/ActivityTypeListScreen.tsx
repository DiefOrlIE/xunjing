import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import api from "../../services/api";

export function ActivityTypeListScreen({ route, navigation }: any) {
  const { typeId, typeName, typeColor } = route.params;
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get("/map/activity-pins", { params: { radius: 50000 } });
      if (res && (res as any).success) {
        const data = ((res as any).data || []).filter((e: any) => {
          const tid = typeof e.typeId === "object" ? e.typeId?._id : e.typeId;
          return tid === typeId;
        });
        setEvents(data);
      }
    } catch {} finally { setLoading(false); }
  }, [typeId]);

  useEffect(() => { fetchAll(); async function fetchAll() { await fetchEvents(); } }, [fetchEvents]);

  const statusLabel = (s: string) => s === "recruiting" ? "🟢 招募中" : s === "waiting" ? "⏳ 等待开始" : s === "ongoing" ? "🔵 进行中" : s;

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={typeColor || colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{typeName}</Text>
      </View>
      <FlatList
        data={events}
        keyExtractor={(e) => e._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("EventDetail", { eventId: item._id })}
            activeOpacity={0.7}
          >
            <View style={[styles.bar, { backgroundColor: typeColor || colors.primary }]} />
            <View style={styles.cardBody}>
              <Text style={{ ...typography.small, color: typeColor || colors.primary, fontWeight: "700" }}>{typeName}</Text>
              <Text style={styles.eventTitle}>{item.title || `${typeName}活动`}</Text>
              <View style={styles.row}>
                <Text style={styles.tag}>{statusLabel(item.status)}</Text>
                <Text style={styles.tag}>👤 {item.currentParticipants || 0}/{item.capacity || "∞"}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.info}>📍 {item.locationText || "暂无地点"}</Text>
              </View>
              <Text style={styles.info}>🕐 {item.startTime ? new Date(item.startTime).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "待定"}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<View style={styles.empty}><Text style={{ fontSize: 48 }}>📭</Text><Text style={{ color: colors.textHint, marginTop: spacing.md }}>暂无该类型的招募活动</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  header: { paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl, elevation: 4, gap: spacing.md },
  backBtn: { paddingHorizontal: spacing.xs },
  backText: { ...typography.h2, color: colors.primary },
  title: { fontFamily: HAND, fontSize: 24, color: colors.ink },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: borderRadius.lg, marginBottom: spacing.sm, overflow: "hidden", elevation: 2 },
  bar: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md, gap: spacing.xs },
  eventTitle: { ...typography.bodyBold, color: colors.textPrimary },
  row: { flexDirection: "row", gap: spacing.sm },
  tag: { ...typography.small, color: colors.textSecondary, fontWeight: "600" },
  info: { ...typography.caption, color: colors.textHint },
  empty: { alignItems: "center", padding: 60 },
});
