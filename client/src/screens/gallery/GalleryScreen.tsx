import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, SectionList, FlatList,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
} from "react-native";
import { colors, typography, spacing, borderRadius, HAND, SERIF } from "../../theme";
import { CollectionCard } from "../../components/CollectionCard";
import { EmptyState } from "../../components/EmptyState";
import { DotPaper } from "../../theme/whaleKit";
import { RARITY_COLORS } from "../../utils/constants";
import { getMyCollections } from "../../services/collection.api";
import { getMyNotes } from "../../services/note.api";
import { CollectionItem, NoteData } from "../../types";

const RARITY_ORDER = ["典藏", "神秘", "限定", "高端", "普通", "常见"];
const TAPE_PALETTE = [colors.accent, colors.secondary, colors.gold, colors.primary, colors.rarity.典藏, colors.green];
const hashNum = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

/** 每行最多3张卡片 */
function chunkRows(items: CollectionItem[]): CollectionItem[][] {
  const rows: CollectionItem[][] = [];
  for (let i = 0; i < items.length; i += 3) {
    rows.push(items.slice(i, i + 3));
  }
  return rows;
}

export function GalleryScreen({ navigation }: any) {
  const [grouped, setGrouped] = useState<Record<string, CollectionItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [myNotes, setMyNotes] = useState<NoteData[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteData | null>(null);
  const listRef = useRef<SectionList>(null);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await getMyCollections();
      if (res.success && res.data) {
        const g: Record<string, CollectionItem[]> = {};
        for (const item of res.data.collections) {
          if (!g[item.rarity]) g[item.rarity] = [];
          g[item.rarity].push(item);
        }
        setGrouped(g);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchCollections(); }, [fetchCollections]);

  const onRefresh = () => { setRefreshing(true); fetchCollections(); };

  const loadNotes = useCallback(async () => {
    setShowNotes(true);
    if (myNotes.length === 0) {
      setNotesLoading(true);
      try { const r = await getMyNotes(); if (r.success && r.data) setMyNotes(r.data); } catch {}
      setNotesLoading(false);
    }
  }, [myNotes.length]);

  // 构建 SectionList 数据：每个 section = 一种稀有度，data = 行数组（每行最多3个）
  const sections = RARITY_ORDER
    .filter((r) => grouped[r]?.length > 0)
    .map((rarity) => ({
      rarity,
      data: chunkRows(grouped[rarity]),
    }));

  const scrollToRarity = (rarity: string) => {
    setSelectedRarity(rarity);
    const idx = sections.findIndex((s) => s.rarity === rarity);
    if (idx >= 0 && listRef.current) {
      listRef.current.scrollToLocation({ sectionIndex: idx, itemIndex: 0, viewOffset: 0, animated: true });
    }
  };

  const totalCount = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>打捞鲸藏中...</Text>
      </View>
    );
  }

  if (sections.length === 0) {
    return (
      <View style={styles.container}>
        <DotPaper />
        <EmptyState emoji="🐚" title="展柜空空的" subtitle="去地图聆听频率，拾取鲸落获得鲸藏吧！" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DotPaper />
      {/* ── 手账标题 + 鲸藏/纸条切换 ── */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>我的展柜</Text>
            <Text style={styles.headerEn}>collection</Text>
          </View>
          <View style={styles.toggle}>
            <TouchableOpacity onPress={() => setShowNotes(false)} style={[styles.toggleCell, !showNotes && styles.toggleCellOn]} activeOpacity={0.7}>
              <Text style={[styles.toggleText, !showNotes && styles.toggleTextOn]}>鲸藏</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={loadNotes} style={[styles.toggleCell, showNotes && styles.toggleCellOn]} activeOpacity={0.7}>
              <Text style={[styles.toggleText, showNotes && styles.toggleTextOn]}>纸条</Text>
            </TouchableOpacity>
          </View>
        </View>
        {!showNotes && <Text style={styles.headerSub}>已采集 {totalCount} 枚鲸藏</Text>}
      </View>

      {/* ── 左侧浮动稀有度标签（纸条模式下隐藏） ── */}
      {!showNotes && <View style={styles.floatTabBar}>
        {RARITY_ORDER.map((rarity) => {
          const has = grouped[rarity]?.length > 0;
          const active = selectedRarity === rarity;
          const color = RARITY_COLORS[rarity] || "#999";
          return (
            <TouchableOpacity
              key={rarity}
              style={[styles.floatTab, active && { backgroundColor: color + "20" }]}
              onPress={() => scrollToRarity(rarity)}
              activeOpacity={0.7}
              disabled={!has}
            >
              <View style={[styles.floatTabDot, { backgroundColor: has ? color : colors.textHint, opacity: has ? 1 : 0.3 }]} />
              <Text style={[styles.floatTabText, { color: has ? color : colors.textHint, opacity: has ? 1 : 0.4 }]}>
                {rarity}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>}

      {showNotes ? (
        <View style={{ flex: 1 }}>
          {notesLoading ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} /> :
           myNotes.length === 0 ? <View style={{ alignItems: "center", paddingTop: 80 }}><Text style={{ fontSize: 48, marginBottom: 12 }}>📝</Text><Text style={{ ...typography.body, color: colors.textHint }}>还未曾拾起过谁的心事</Text><Text style={{ ...typography.caption, color: colors.textHint, marginTop: 4 }}>去地图上发现并拾取吧！</Text></View> :
           <FlatList data={myNotes} keyExtractor={(n: any) => n._id} contentContainerStyle={{ padding: spacing.md }}
             renderItem={({ item: n }: any) => (
               <TouchableOpacity activeOpacity={0.7} onPress={() => setSelectedNote(n)} style={styles.noteCard}>
                 <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                   {n.isAnonymous ? (
                     <View style={{flexDirection:"row",alignItems:"center",gap:6}}><Text style={{fontSize:18}}>🕶️</Text><Text style={{fontWeight:"600",fontSize:13,color:"#9B8C7C"}}>匿名</Text></View>
                   ) : (
                     <View style={{flexDirection:"row",alignItems:"center",gap:8}}>
                       <View style={{width:28,height:28,borderRadius:14,backgroundColor:"#E8D5B7",alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:14}}>👤</Text></View>
                       <View>
                         <Text style={{fontWeight:"700",fontSize:13,color:"#4A3728"}}>{n.authorNickname}</Text>
                         {(n.authorNumericId && n.authorNumericId > 0) ? <Text style={{fontSize:10,color:"#9B8C7C"}}>ID {n.authorNumericId}</Text> : null}
                       </View>
                     </View>
                   )}
                   <Text style={{fontSize:10,color:"#B8A898"}}>{new Date(n.pickedAt).toLocaleDateString("zh-CN",{month:"short",day:"numeric"})}</Text>
                 </View>
                 <Text style={{fontSize:15,lineHeight:22,color:"#4A3728",fontStyle:"italic"}} numberOfLines={3}>{n.content}</Text>
                 <Text style={{fontSize:10,color:"#B8A898",marginTop:8}}>📋 {new Date(n.pickedAt).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} 拾取</Text>
               </TouchableOpacity>
             )}
           />
          }
        </View>
      ) : (
      /* ── 虚拟化列表（只渲染可见区域的卡片） ── */
      <SectionList
        ref={listRef as any}
        sections={sections}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        keyExtractor={(row: CollectionItem[], idx) => `${row[0]?.collectionId || idx}-${idx}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
        renderSectionHeader={({ section }) => {
          const color = RARITY_COLORS[section.rarity] || "#999";
          const count = grouped[section.rarity]?.length || 0;
          return (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color }]}>{section.rarity === "神秘" ? "✦ " : ""}{section.rarity}</Text>
              <View style={[styles.sectionRule, { borderBottomColor: color + "77" }]} />
              <Text style={styles.sectionCount}>{count} 枚</Text>
            </View>
          );
        }}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            {row.map((item) => {
              const hn = hashNum(item.collectionId || item.name);
              return (
                <CollectionCard
                  key={item.collectionId}
                  name={item.name}
                  imageUrl={item.imageUrl}
                  thumbnailUrl={item.thumbnailUrl}
                  rarity={item.rarity}
                  count={item.count}
                  rotate={(hn % 7) - 3}
                  tapeColor={TAPE_PALETTE[hn % TAPE_PALETTE.length]}
                  onPress={() => navigation.navigate("ItemDetail", { item })}
                />
              );
            })}
            {row.length < 3 && (
              <View style={{ width: row.length === 2 ? "31%" : "62%" }} />
            )}
          </View>
        )}
        initialNumToRender={12}
        maxToRenderPerBatch={9}
        windowSize={5}
        removeClippedSubviews={true}
      />
      )}

      <Modal visible={!!selectedNote} transparent animationType="fade" onRequestClose={() => setSelectedNote(null)}>
        <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.55)",justifyContent:"center",alignItems:"center",padding:24}}>
          <View style={{backgroundColor:"#FFFBF2",borderRadius:20,padding:24,width:"100%",maxWidth:400}}>
            {selectedNote && (<View style={{width:"100%",alignItems:"center"}}>
              <Text style={{fontSize:56,marginBottom:12}}>📜</Text>
              <View style={{backgroundColor:"#FFF9E6",borderRadius:16,borderWidth:1,borderColor:"#E6D5A8",width:"100%",height:200}}>
                <ScrollView style={{flex:1}} nestedScrollEnabled contentContainerStyle={{padding:18}}>
                  <Text style={{fontSize:16,lineHeight:26,color:"#4A3728"}}>{selectedNote.content}</Text>
                </ScrollView>
              </View>
              {!selectedNote.isAnonymous && <View style={{flexDirection:"row",alignItems:"center",marginTop:14,gap:8}}>
                <View style={{width:32,height:32,borderRadius:16,backgroundColor:"#E8D5B7",alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:16}}>👤</Text></View>
                <View><Text style={{fontWeight:"700",fontSize:14,color:"#4A3728"}}>{selectedNote.authorNickname}</Text>{(selectedNote.authorNumericId && selectedNote.authorNumericId > 0) ? <Text style={{fontSize:11,color:"#9B8C7C"}}>ID {selectedNote.authorNumericId}</Text> : null}</View>
              </View>}
              <View style={{flexDirection:"row",marginTop:14,gap:24}}>
                <Text style={{fontSize:11,color:"#9B8C7C"}}>🕐 {new Date(selectedNote.createdAt).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})} 留下</Text>
                <Text style={{fontSize:11,color:"#9B8C7C"}}>📋 {selectedNote.pickedAt ? new Date(selectedNote.pickedAt).toLocaleString("zh-CN",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) : ""} 拾取</Text>
              </View>
              <TouchableOpacity style={{backgroundColor:"#C8956C",borderRadius:20,paddingVertical:16,width:"100%",alignItems:"center",marginTop:18}} onPress={() => setSelectedNote(null)}>
                <Text style={{color:"#FFFFFF",fontWeight:"800",fontSize:16}}>📋 收起纸条</Text>
              </TouchableOpacity>
            </View>)}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  header: { paddingTop: 56, paddingBottom: spacing.sm, paddingHorizontal: spacing.xl, zIndex: 10 },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerTitleWrap: { flexDirection: "row", alignItems: "flex-end", gap: 9 },
  headerTitle: { fontFamily: HAND, fontSize: 27, color: colors.ink, lineHeight: 30 },
  headerEn: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: colors.secondary, paddingBottom: 3 },
  headerSub: { ...typography.caption, color: colors.textSecondary, marginTop: 6 },
  toggle: { flexDirection: "row", backgroundColor: colors.primary + "10", borderRadius: 999, padding: 3 },
  toggleCell: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  toggleCellOn: { backgroundColor: colors.primary },
  toggleText: { ...typography.caption, fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  toggleTextOn: { color: "#FFF" },
  floatTabBar: {
    position: "absolute", left: 4, top: "22%", zIndex: 20,
    backgroundColor: colors.surface + "F0", borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm, paddingHorizontal: 2,
    shadowColor: colors.ink, shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5, gap: 2,
  },
  floatTab: { alignItems: "center", paddingVertical: spacing.xs, paddingHorizontal: 6, borderRadius: borderRadius.sm },
  floatTabDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 1 },
  floatTabText: { fontSize: 9, fontWeight: "700" },
  list: { flex: 1, marginLeft: 36, backgroundColor: "transparent" },
  listContent: { padding: spacing.md, paddingBottom: 120 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.md, marginBottom: spacing.sm, paddingHorizontal: 2 },
  sectionTitle: { fontFamily: HAND, fontSize: 19, transform: [{ rotate: "-2deg" }] },
  sectionRule: { flex: 1, height: 1, borderBottomWidth: 1.5, borderStyle: "dotted" },
  sectionCount: { ...typography.caption, color: colors.textHint },
  row: { flexDirection: "row", justifyContent: "flex-start", gap: spacing.sm, marginBottom: spacing.sm },
  noteCard: { backgroundColor: "#FFFBF2", borderRadius: 16, padding: 18, marginBottom: 12, marginHorizontal: 4, borderWidth: 1, borderColor: "#E6D5A8", shadowColor: "#C8956C", shadowOffset: {width:0,height:2}, shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
});
