import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, SectionList, ActivityIndicator } from "react-native";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { CollectionCard } from "../../components/CollectionCard";
import { EmptyState } from "../../components/EmptyState";
import { RARITY_COLORS } from "../../utils/constants";
import { getUserCollections } from "../../services/collection.api";

const RARITY_ORDER = ["典藏", "神秘", "限定", "高端", "普通", "常见"];

function chunkRows(items: any[]): any[][] {
  const rows: any[][] = [];
  for (let i = 0; i < items.length; i += 3) {
    rows.push(items.slice(i, i + 3));
  }
  return rows;
}

export function UserGalleryScreen({ route, navigation }: any) {
  const { userId, nickname } = route.params;
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await getUserCollections(userId);
        if (res.success && res.data) {
          const g: Record<string, any[]> = {};
          (res.data.collections || []).forEach((item: any) => {
            if (!g[item.rarity]) g[item.rarity] = [];
            g[item.rarity].push(item);
          });
          setGrouped(g);
          setTotal(res.data.collections?.length || 0);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [userId]);

  const sections = RARITY_ORDER
    .filter((r) => grouped[r]?.length > 0)
    .map((rarity) => ({
      rarity,
      data: chunkRows(grouped[rarity]),
    }));

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backText}>← 返回</Text></TouchableOpacity>
        <Text style={styles.title}>{nickname || "好友"} 的展柜</Text>
        <Text style={styles.subtitle}>共 {total} 件藏品</Text>
      </View>

      {sections.length === 0 ? (
        <EmptyState emoji="🏛️" title="TA还没有藏品" subtitle="好友还没开始收集藏品" />
      ) : (
        <SectionList
          sections={sections}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          keyExtractor={(row: any[], idx) => `${row[0]?.itemId || idx}-${idx}`}
          initialNumToRender={12}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews={true}
          renderSectionHeader={({ section }) => {
            const color = RARITY_COLORS[section.rarity] || "#999";
            const count = grouped[section.rarity]?.length || 0;
            return (
              <View style={[styles.sectionHeader, { borderLeftColor: color, backgroundColor: color + "12" }]}>
                <Text style={[styles.sectionTitle, { color }]}>{section.rarity}</Text>
                <Text style={styles.sectionCount}>{count} 件</Text>
              </View>
            );
          }}
          renderItem={({ item: row }) => (
            <View style={styles.row}>
              {row.map((item: any, idx: number) => (
                <CollectionCard key={idx} name={item.name} imageUrl={item.imageUrl} thumbnailUrl={item.thumbnailUrl} rarity={item.rarity} count={item.count} disabled />
              ))}
              {row.length < 3 && (
                <View style={{ width: row.length === 2 ? "31%" : "62%", marginBottom: 0 }} />
              )}
            </View>
          )}
        />
      )}
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
  backText: { ...typography.body, color: colors.primary, fontWeight: "600", marginBottom: spacing.md },
  title: { fontFamily: HAND, fontSize: 24, color: colors.ink },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitleHand: { fontFamily: HAND },
  list: { flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: 120 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, borderLeftWidth: 4, marginBottom: spacing.sm, marginTop: spacing.md,
  },
  sectionTitle: { ...typography.bodyBold, fontSize: 15 },
  sectionCount: { ...typography.caption, color: colors.textSecondary },
  row: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
});
