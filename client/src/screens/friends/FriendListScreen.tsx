import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Alert, TextInput, Image,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { colors, typography, spacing, borderRadius, HAND, SERIF, BODY, KAI } from "../../theme";
import { Waveform } from "../../theme/whaleKit";
import { Avatar } from "../../components/Avatar";
import { EmptyState } from "../../components/EmptyState";
import { getFriends, getFriendRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } from "../../services/friend.api";
import { getUserByNumericId } from "../../services/user.api";
import { FriendData, FriendRequest, PublicUser } from "../../types";

export function FriendListScreen({ navigation }: any) {
  const [friends, setFriends] = useState<FriendData[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<PublicUser | null>(null);
  const [searchError, setSearchError] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [fRes, rRes] = await Promise.all([getFriends(), getFriendRequests()]);
      if (fRes.success && fRes.data) setFriends(fRes.data);
      if (rRes.success && rRes.data) setRequests(rRes.data);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = async () => { setRefreshing(true); await fetchData(); setRefreshing(false); };

  const handleSearch = async () => {
    const id = parseInt(searchId.trim());
    if (!id) { setSearchError("请输入有效的数字ID"); return; }
    setSearching(true); setSearchError(""); setSearchResult(null);
    try {
      const res = await getUserByNumericId(id);
      if (res.success && res.data) {
        setSearchResult(res.data);
      } else {
        setSearchError("未查找到该用户");
      }
    } catch (err: any) {
      setSearchError(err?.error || "未查找到该用户");
    } finally { setSearching(false); }
  };

  const handleAddFriend = async () => {
    if (!searchResult) return;
    setSearching(true);
    try {
      await sendFriendRequest(searchResult.userId);
      Alert.alert("✅", "好友申请已发送");
      setSearchResult(null); setSearchId("");
    } catch (err: any) {
      Alert.alert("发送失败", err?.error || "请稍后再试");
    } finally { setSearching(false); }
  };

  const handleAccept = async (requestId: string) => {
    await acceptFriendRequest(requestId);
    fetchData();
  };
  const handleReject = async (requestId: string) => {
    await rejectFriendRequest(requestId);
    fetchData();
  };

  const renderFriend = ({ item }: { item: FriendData }) => (
    <TouchableOpacity
      style={styles.rosterRow}
      activeOpacity={0.7}
      onPress={() => navigation.navigate("Chat", { friend: { id: item.id, userId: item.userId, nickname: item.nickname, avatar: item.avatar } })}
    >
      <Avatar uri={item.avatar || undefined} size={46} emoji={item.nickname.charAt(0)} borderColor={colors.secondary} />
      <View style={styles.rosterInfo}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
          <Text style={styles.rosterName}>{item.nickname}</Text>
          <Text style={styles.rosterId}>ID {item.userId}</Text>
        </View>
        <Text style={styles.rosterMsg} numberOfLines={1}>{item.lastMessage || "暂无消息"}</Text>
      </View>
      <View style={styles.rosterRight}>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); navigation.navigate("UserGallery", { userId: item.userId, nickname: item.nickname }); }}
          activeOpacity={0.7}
          style={styles.rosterTopRow}
        >
          <Image source={require("../../../assets/icons/icon_gallery.png")} style={styles.rosterGalleryIcon} />
          <Waveform w={30} h={9} color={colors.secondary} sw={1.3} opacity={0.75} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation?.(); navigation.navigate("UserGallery", { userId: item.userId, nickname: item.nickname }); }}
          activeOpacity={0.7}
          style={styles.rosterGalleryBtn}
        >
          <Text style={styles.rosterGalleryTxt}>TA的展柜 ›</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 9 }}>
            <Text style={styles.headerTitle}>同船好友</Text>
            <Text style={styles.headerEn}>shipmates</Text>
          </View>
          <TouchableOpacity style={styles.plusBtn} onPress={() => setShowPanel(!showPanel)} activeOpacity={0.8}>
            <Text style={styles.plusGlyph}>{showPanel ? "×" : "+"}</Text>
            {requests.length > 0 && !showPanel && <View style={styles.plusDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* 添加好友面板 */}
      {showPanel && (
        <View style={styles.addPanel}>
          <Text style={styles.addTitle}>添加好友</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="请输入Ta的ID"
              placeholderTextColor={colors.textHint}
              value={searchId}
              onChangeText={(v) => { setSearchId(v); setSearchResult(null); setSearchError(""); }}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
              <Text style={styles.searchBtnText}>{searching ? "..." : "搜索"}</Text>
            </TouchableOpacity>
          </View>
          {searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
          {searchResult && (
            <View style={styles.searchResultCard}>
              <Avatar uri={searchResult.avatar || undefined} size={48} emoji={searchResult.nickname?.charAt(0) || "?"} />
              <View style={styles.searchResultInfo}>
                <Text style={styles.searchResultName}>{searchResult.nickname}</Text>
                <Text style={styles.searchResultId}>ID: {searchResult.userId}</Text>
              </View>
              <TouchableOpacity style={styles.searchGalleryBtn} onPress={() => navigation.navigate("UserGallery", { userId: searchResult.userId, nickname: searchResult.nickname })}>
                <Text style={styles.searchGalleryBtnText}>🏛️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.searchAddBtn} onPress={handleAddFriend} disabled={searching}>
                <Text style={styles.searchAddBtnText}>添加</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* 好友申请面板 */}
      {showPanel && (
        <View style={styles.requestsPanel}>
          <Text style={styles.addTitle}>好友申请</Text>
          {requests.length === 0 ? (
            <Text style={styles.emptyRequests}>暂无待处理的好友申请</Text>
          ) : (
            requests.map((req) => (
              <View key={req._id} style={styles.requestItem}>
                <Avatar size={40} emoji={req.userId?.nickname?.charAt(0) || "?"} />
                <View style={styles.requestInfo}>
                  <Text style={styles.requestName}>{req.userId?.nickname || "未知"}</Text>
                  <Text style={styles.requestId}>ID: {req.userId?.userId}</Text>
                </View>
                <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(req._id)}>
                  <Text style={styles.acceptBtnText}>同意</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req._id)}>
                  <Text style={styles.rejectBtnText}>婉拒</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        renderItem={renderFriend}
        contentContainerStyle={friends.length === 0 ? styles.emptyList : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        ListEmptyComponent={<EmptyState emoji="🤝" title="还没有好友" subtitle="通过ID搜索添加好友，一起探索校园！" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 54, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.background, zIndex: 10,
  },
  headerTitle: { fontFamily: HAND, fontSize: 27, color: colors.ink, lineHeight: 30 },
  headerEn: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: colors.secondary, paddingBottom: 3 },
  headerRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  plusBtn: { paddingHorizontal: 6, alignItems: "center", justifyContent: "center", marginBottom: -6 },
  plusGlyph: { color: colors.primaryDark, fontSize: 30, fontWeight: "400", lineHeight: 32, textAlign: "center", includeFontPadding: false } as any,
  plusDot: { position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, borderWidth: 1.5, borderColor: colors.background },
  headerBtns: { flexDirection: "row", gap: spacing.sm },
  headerBtn: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, alignItems: "center",
  },
  headerBtnAlert: { backgroundColor: colors.error + "12", borderWidth: 1, borderColor: colors.error + "30" },
  headerBtnText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
  headerBtnAdd: { backgroundColor: colors.primary + "12" },
  headerBtnAddText: { color: colors.primary },
  addPanel: {
    backgroundColor: colors.surface, margin: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  addTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  searchRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  searchInput: {
    flex: 1, ...typography.body, backgroundColor: colors.background, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  searchBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.lg, justifyContent: "center" },
  searchBtnText: { ...typography.caption, fontWeight: "700", color: colors.textOnPrimary },
  searchError: { ...typography.caption, color: colors.error, marginTop: spacing.xs },
  searchResultCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.primary + "06",
    borderRadius: borderRadius.md, padding: spacing.md, marginTop: spacing.sm, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.primary + "20",
  },
  searchResultInfo: { flex: 1 },
  searchResultName: { ...typography.bodyBold, color: colors.textPrimary },
  searchResultId: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  searchGalleryBtn: { padding: spacing.sm },
  searchGalleryBtnText: { fontSize: 24 },
  searchAddBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg },
  searchAddBtnText: { ...typography.caption, fontWeight: "700", color: "#FFF" },
  requestsPanel: { backgroundColor: colors.surface, margin: spacing.md, borderRadius: borderRadius.lg, padding: spacing.md },
  emptyRequests: { ...typography.body, color: colors.textHint, textAlign: "center", paddingVertical: spacing.lg },
  requestItem: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.sm },
  requestInfo: { flex: 1 },
  requestName: { ...typography.bodyBold, color: colors.textPrimary },
  requestId: { ...typography.caption, color: colors.textHint },
  acceptBtn: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  acceptBtnText: { ...typography.caption, fontWeight: "700", color: "#FFF" },
  rejectBtn: { backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  rejectBtnText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
  // 船员名录（方案 A：无卡片 + 发丝分隔）
  rosterRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  rosterInfo: { flex: 1, gap: 3 },
  rosterName: { fontFamily: HAND, fontSize: 19, color: colors.ink, lineHeight: 22 },
  rosterId: { fontFamily: BODY, fontSize: 10, color: colors.faded },
  rosterMsg: { fontFamily: KAI, fontSize: 12.5, color: colors.sub },
  rosterRight: { alignItems: "flex-end", gap: 5 },
  rosterTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rosterGalleryBtn: { marginTop: 3 },
  rosterGalleryIcon: { width: 28, height: 28, borderRadius: 7 },
  rosterGalleryTxt: { fontFamily: BODY, fontSize: 11.5, fontWeight: "700", color: colors.primary },
  emptyList: { flex: 1 },
  listContent: { paddingBottom: 100, paddingTop: 2 },
});
