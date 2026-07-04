import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, Alert, ActivityIndicator, Modal, ScrollView,
  Image, Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { RarityBadge } from "../../components/RarityBadge";
import { EmptyState } from "../../components/EmptyState";
import {
  listItems, createItem, updateItem, deleteItem, reactivateItem, permanentlyDeleteItem,
  listEventTypes, createEventType, updateEventType, deleteEventType,
  getDashboard, giftItem, getUserItemCounts,
} from "../../services/admin.api";
import { getAllFeedback, resolveFeedback, FeedbackItem } from "../../services/feedback.api";
import { getAllReports, resolveReport, banUser, ReportItem } from "../../services/report.api";
import api, { fixImageUrl } from "../../services/api";
import { ItemDetail, EventTypeData } from "../../types";

const RARITY_OPTIONS = ["典藏", "神秘", "限定", "高端", "普通", "常见"];

export function AdminPanelScreen({ navigation }: any) {
  const [tab, setTab] = useState<"items" | "eventTypes" | "dashboard" | "chests" | "gift" | "feedback" | "reports">("dashboard");
  const [loading, setLoading] = useState(true);

  // 反馈
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackFilter, setFeedbackFilter] = useState<"pending" | "resolved" | "all">("pending");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  // 举报
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [reportFilter, setReportFilter] = useState<"pending" | "resolved" | "dismissed" | "all">("pending");
  const [banningReportId, setBanningReportId] = useState<string | null>(null);
  const [banDays, setBanDays] = useState("0");
  const [banReasonInput, setBanReasonInput] = useState("");
  const [banSubmitting, setBanSubmitting] = useState(false);

  const [dashboard, setDashboard] = useState({ totalUsers: 0, activeChests: 0, activeEvents: 0 });
  const [chestType, setChestType] = useState("normal");
  const [chestCampus, setChestCampus] = useState("gulou");
  const [chestCoord, setChestCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [chestRequiredPlayers, setChestRequiredPlayers] = useState(3);
  const [chestCreating, setChestCreating] = useState(false);
  const [activeChests, setActiveChests] = useState<any[]>([]);
  const [chestConfig, setChestConfig] = useState<any>({ gulou: { maxNormalChests: 3, advancedChance: 0.2, normalCooldownHours: 1, advancedCooldownHours: 1 }, xianlin: { maxNormalChests: 3, advancedChance: 0.2, normalCooldownHours: 1, advancedCooldownHours: 1 }, suzhou: { maxNormalChests: 3, advancedChance: 0.2, normalCooldownHours: 1, advancedCooldownHours: 1 } });
  const [dropConfig, setDropConfig] = useState<any>({ normal: {}, advanced: {} });
  const [giftUserId, setGiftUserId] = useState("");
  const [giftItemIds, setGiftItemIds] = useState<string[]>([]);
  const [giftSelectedIds, setGiftSelectedIds] = useState<string[]>([]);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [gifting, setGifting] = useState(false);
  const [giftToast, setGiftToast] = useState("");
  const [giftUserCounts, setGiftUserCounts] = useState<Record<string, number>>({});
  const [giftSearchKeyword, setGiftSearchKeyword] = useState("");
  const [giftSearchRarity, setGiftSearchRarity] = useState<string | null>(null);
  const [campusBounds, setCampusBounds] = useState<any>({ gulou: {}, xianlin: {}, suzhou: {} });
  const [savingBounds, setSavingBounds] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickImage = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0]; if (!file) return;
        setUploading(true);
        try {
          const fd = new FormData(); fd.append("image", file);
          const token = await AsyncStorage.getItem("token");
          const res = await fetch("https://seekwhale.cn/api/v1/upload/item-image", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
          const data = await res.json();
          if (data.success) { setFormImageUrl(data.data.url); Alert.alert("✅", "图片上传成功"); }
          else { Alert.alert("上传失败", data.error || "请稍后再试"); }
        } catch (e: any) { Alert.alert("上传失败", "网络错误"); }
        finally { setUploading(false); }
      };
      input.click();
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("提示", "需要相册权限"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      try {
        const formData = new FormData();
        const uri = result.assets[0].uri;
        const ext = uri.split(".").pop() || "jpg";
        formData.append("image", { uri, name: `item.${ext}`, type: `image/${ext}` } as any);
        const res = await api.post("/upload/item-image", formData);
        if (res && (res as any).success) {
          setFormImageUrl((res as any).data.url);
          Alert.alert("✅", "图片上传成功");
        }
      } catch (e: any) { Alert.alert("上传失败", e?.error || "请稍后再试"); }
      finally { setUploading(false); }
    }
  };
  const [items, setItems] = useState<ItemDetail[]>([]);
  const [allItems, setAllItems] = useState<ItemDetail[]>([]); // 全量藏品（不受搜索影响，用于赠送选择器）
  const [types, setTypes] = useState<EventTypeData[]>([]);
  // 藏品搜索
  const [itemSearchKeyword, setItemSearchKeyword] = useState("");
  const [itemSearchRarity, setItemSearchRarity] = useState<string | null>(null);
  const itemSearchDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemDetail | null>(null);
  const [editingType, setEditingType] = useState<EventTypeData | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formRarity, setFormRarity] = useState("常见");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDropWeight, setFormDropWeight] = useState("1");
  const [formIconUrl, setFormIconUrl] = useState("");
  const [formColor, setFormColor] = useState("#3498DB");
  const [formSortOrder, setFormSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [dRes, iRes, tRes, cRes, chestRes] = await Promise.all([
        getDashboard(), listItems(1, 100, undefined, undefined, true), listEventTypes(),
        api.get("/admin/campus-bounds"), api.get("/admin/chests"),
      ]);
      if (dRes.success && dRes.data) setDashboard(dRes.data);
      if (iRes.success && iRes.data) { setItems(iRes.data.items); setAllItems(iRes.data.items); }
      if (tRes.success && tRes.data) setTypes(tRes.data);
      if (chestRes && (chestRes as any).success) setActiveChests((chestRes as any).data || []);
      if (cRes && (cRes as any).success) {
        const b: any = { gulou: {}, xianlin: {}, suzhou: {} };
        ((cRes as any).data || []).forEach((c: any) => { b[c.campus] = c; });
        setCampusBounds(b);
      }
      try {
        const cfgRes = await api.get("/admin/chest-config");
        if (cfgRes && (cfgRes as any).success) setChestConfig((cfgRes as any).data);
      } catch {}
      try {
        const dropRes = await api.get("/admin/drop-config");
        if (dropRes && (dropRes as any).success) setDropConfig((dropRes as any).data || { normal: {}, advanced: {} });
      } catch {}
      // 拉取反馈
      try {
        const fbRes = await getAllFeedback(1, 100, feedbackFilter === "all" ? undefined : feedbackFilter);
        if (fbRes.success && fbRes.data) {
          setFeedbacks(fbRes.data.items);
          setFeedbackTotal(fbRes.data.total);
        }
      } catch {}
      // 拉取举报
      try {
        const rpRes = await getAllReports(1, 100, reportFilter === "all" ? undefined : reportFilter);
        if (rpRes.success && rpRes.data) setReports(rpRes.data.items);
      } catch {}
    } catch {} finally { setLoading(false); }
  }, [feedbackFilter, reportFilter]);

  // 仅刷新藏品列表（搜索用，避免全量刷新）
  const fetchItems = useCallback(async (kw: string, rarity: string | null) => {
    try {
      const iRes = await listItems(1, 100, rarity || undefined, kw.trim() || undefined, true);
      if (iRes.success && iRes.data) setItems(iRes.data.items);
    } catch {}
  }, []);

  // 搜索防抖
  const handleItemSearch = useCallback((text: string) => {
    setItemSearchKeyword(text);
    if (itemSearchDebounceRef.current) clearTimeout(itemSearchDebounceRef.current);
    itemSearchDebounceRef.current = setTimeout(() => {
      fetchItems(text, itemSearchRarity);
    }, 350);
  }, [fetchItems, itemSearchRarity]);

  const handleItemRarityFilter = useCallback((rarity: string | null) => {
    setItemSearchRarity(rarity);
    fetchItems(itemSearchKeyword, rarity);
  }, [fetchItems, itemSearchKeyword]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── 藏品表单 ──
  const openItemForm = (item?: ItemDetail) => {
    setEditingType(null);
    if (item) {
      setEditingItem(item); setFormName(item.name); setFormDesc(item.description);
      setFormRarity(item.rarity); setFormImageUrl(item.imageUrl); setFormDropWeight(String(item.dropWeight));
    } else {
      setEditingItem(null); setFormName(""); setFormDesc(""); setFormRarity("常见");
      setFormImageUrl(""); setFormDropWeight("1");
    }
    setShowForm(true);
  };

  const handleSaveItem = async () => {
    if (!formName.trim()) { Alert.alert("提示", "请输入藏品名称"); return; }
    setSaving(true);
    try {
      const payload = { name: formName.trim(), description: formDesc.trim(), rarity: formRarity, imageUrl: formImageUrl.trim() || "https://via.placeholder.com/200", dropWeight: parseFloat(formDropWeight) || 1 };
      if (editingItem) {
        await updateItem(editingItem._id, payload);
      } else {
        await createItem(payload);
      }
      setShowForm(false); fetchAll();
    } catch (err: any) { Alert.alert("保存失败", err?.error || ""); }
    finally { setSaving(false); }
  };

  const handleDeleteItem = (item: ItemDetail) => {
    Alert.alert("确认删除", `确定要删除藏品"${item.name}"吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        try { await deleteItem(item._id); Alert.alert("已删除", "藏品已停用"); fetchAll(); }
        catch (e: any) { Alert.alert("失败", e?.error || "删除失败"); }
      }},
    ]);
  };

  const handleDeleteType = (type: EventTypeData) => {
    Alert.alert("确认删除", `确定要删除活动类型"${type.name}"吗？`, [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        try { await deleteEventType(type._id); Alert.alert("已删除"); fetchAll(); }
        catch (e: any) { Alert.alert("失败", e?.error || "删除失败"); }
      }},
    ]);
  };

  const handleRemoveChest = async (id: string) => {
    Alert.alert("删除宝箱", "确定要删除这个宝箱吗？它将从地图上消失。", [
      { text: "取消", style: "cancel" },
      { text: "删除", style: "destructive", onPress: async () => {
        try { await api.delete(`/admin/chests/${id}`); Alert.alert("已删除"); fetchAll(); }
        catch (e: any) { Alert.alert("失败", e?.error || ""); }
      }},
    ]);
  };

  const handleCreateChest = async () => {
    if (!chestCoord) { Alert.alert("提示", "请先在地图上选择宝箱位置"); return; }
    setChestCreating(true);
    try {
      const res = await api.post("/admin/chests", { type: chestType, campus: chestCampus, coordinates: chestCoord, requiredPlayers: chestRequiredPlayers });
      if (res.success) { Alert.alert("✅", "宝箱已生成"); setChestCoord(null); fetchAll(); }
    } catch (e: any) { Alert.alert("失败", e?.error || "发布失败"); }
    finally { setChestCreating(false); }
  };

  // ── 活动类型表单 ──
  const openTypeForm = (type?: EventTypeData) => {
    setEditingItem(null);
    if (type) {
      setEditingType(type); setFormName(type.name); setFormIconUrl(type.iconUrl); setFormColor(type.color || "#3498DB"); setFormSortOrder(String(type.sortOrder || 0));
    } else {
      setEditingType(null); setFormName(""); setFormIconUrl(""); setFormColor("#3498DB"); setFormSortOrder("0");
    }
    setShowForm(true);
  };

  const handleSaveType = async () => {
    if (!formName.trim()) { Alert.alert("提示", "请输入类型名称"); return; }
    setSaving(true);
    try {
      const payload = { name: formName.trim(), iconUrl: formIconUrl.trim() || "https://via.placeholder.com/32", color: formColor, sortOrder: parseInt(formSortOrder) || 0 };
      if (editingType) {
        await updateEventType(editingType._id, payload);
      } else {
        await createEventType(payload);
      }
      setShowForm(false); fetchAll();
    } catch (err: any) { Alert.alert("保存失败", err?.error || ""); }
    finally { setSaving(false); }
  };


  const handleResolveReport = async (id: string, status: "resolved" | "dismissed") => {
    try { await resolveReport(id, { status }); fetchAll(); }
    catch (e: any) { Alert.alert("失败", e?.error || ""); }
  };

  const handleBanUser = async (userMongoId: string) => {
    setBanSubmitting(true);
    try {
      const days = parseInt(banDays) || 0;
      await banUser(userMongoId, { banned: true, banReason: banReasonInput.trim(), banDays: days });
      Alert.alert("✅", days > 0 ? `已封禁 ${days} 天` : "已永久封禁");
      setBanningReportId(null); setBanDays("0"); setBanReasonInput("");
      fetchAll();
    } catch (e: any) { Alert.alert("失败", e?.error || "封禁失败"); }
    finally { setBanSubmitting(false); }
  };

  const isItemForm = editingItem !== null || (editingType === null && tab === "items");
  const isTypeForm = editingType !== null || (editingItem === null && tab === "eventTypes");

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.rarity.典藏} /><Text style={styles.loadingText}>加载管理面板...</Text></View>;
  }

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: spacing.md }}><Text style={{ ...typography.h2, color: colors.primary }}>← 返回</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>船长舱 · 管理</Text>
      </View>

      {/* Tab切换 */}
      <View style={styles.tabRow}>
        {[
          { key: "dashboard" as const, label: "📊 概览" },
          { key: "items" as const, label: "🎁 藏品" },
          { key: "gift" as const, label: "🎁 赠送" },
          { key: "eventTypes" as const, label: "🏷️ 类型" },
          { key: "chests" as const, label: "📦 宝箱" },
          { key: "feedback" as const, label: "📮 反馈" },
          { key: "reports" as const, label: "🚩 举报" },
        ].map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 概览（含校区边界管理） */}
      {tab === "dashboard" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={styles.dashboard}>
            <View style={styles.dashCard}><Text style={styles.dashNumber}>{dashboard.totalUsers}</Text><Text style={styles.dashLabel}>总用户</Text></View>
            <View style={styles.dashCard}><Text style={styles.dashNumber}>{dashboard.activeChests}</Text><Text style={styles.dashLabel}>活跃宝箱</Text></View>
            <View style={styles.dashCard}><Text style={styles.dashNumber}>{dashboard.activeEvents}</Text><Text style={styles.dashLabel}>活跃活动</Text></View>
          </View>

          <View style={{ padding: spacing.md }}>
            <Text style={styles.chestTitle}>🗺️ 校区边界设置</Text>
            <Text style={{ ...typography.caption, color: colors.textHint, marginBottom: spacing.lg }}>
              在地图上点击选择西南角和东北角，构成一个矩形区域作为宝箱刷新范围。
            </Text>

            {["gulou", "xianlin", "suzhou"].map((c) => {
              const b = campusBounds[c] || {};
              const label = c === "gulou" ? "🏫 鼓楼校区" : c === "xianlin" ? "🏢 仙林校区" : "🏛️ 苏州校区";
              const hasSW = b.minLat != null && b.minLng != null;
              const hasNE = b.maxLat != null && b.maxLng != null;
              return (
                <View key={c} style={styles.boundsCard}>
                  <Text style={styles.boundsTitle}>{label}</Text>
                  <TouchableOpacity style={styles.mapPickBtn} onPress={() => {
                    navigation.navigate("MapPicker", { campus: c, onSelect: (coord: any) => {
                      setCampusBounds((prev: any) => ({ ...prev, [c]: { ...prev[c], minLat: coord.lat, minLng: coord.lng, minLatStr: String(coord.lat), minLngStr: String(coord.lng) } }));
                    }});
                  }}>
                    {hasSW ? (
                      <Text style={styles.mapPickDone}>✅ 西南角: {b.minLat?.toFixed(5)}, {b.minLng?.toFixed(5)} (点击重选)</Text>
                    ) : (
                      <Text style={styles.mapPickEmpty}>📍 点击选择西南角</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.mapPickBtn, { marginTop: spacing.sm }]} onPress={() => {
                    navigation.navigate("MapPicker", { campus: c, onSelect: (coord: any) => {
                      setCampusBounds((prev: any) => ({ ...prev, [c]: { ...prev[c], maxLat: coord.lat, maxLng: coord.lng, maxLatStr: String(coord.lat), maxLngStr: String(coord.lng) } }));
                    }});
                  }}>
                    {hasNE ? (
                      <Text style={styles.mapPickDone}>✅ 东北角: {b.maxLat?.toFixed(5)}, {b.maxLng?.toFixed(5)} (点击重选)</Text>
                    ) : (
                      <Text style={styles.mapPickEmpty}>📍 点击选择东北角</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity style={[styles.createChestBtn, savingBounds && styles.createChestBtnDisabled]} onPress={async () => {
              setSavingBounds(true);
              try {
                for (const c of ["gulou", "xianlin", "suzhou"]) {
                  const b = campusBounds[c] || {};
                  const payload = {
                    campus: c,
                    minLng: parseFloat(b.minLngStr || b.minLng || 0),
                    maxLng: parseFloat(b.maxLngStr || b.maxLng || 0),
                    minLat: parseFloat(b.minLatStr || b.minLat || 0),
                    maxLat: parseFloat(b.maxLatStr || b.maxLat || 0),
                  };
                  await api.put("/admin/campus-bounds", payload);
                }
                Alert.alert("✅", "校区边界已更新");
                fetchAll();
              } catch (e: any) { Alert.alert("失败", e?.error || "保存失败"); }
              finally { setSavingBounds(false); }
            }} disabled={savingBounds}>
              <Text style={styles.createChestBtnText}>{savingBounds ? "保存中..." : "💾 保存边界"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* 藏品列表：活跃 + 已停用 */}
      {tab === "items" && (() => {
        const activeItems = items.filter((i) => i.isActive !== false);
        const inactiveItems = items.filter((i) => i.isActive === false);
        return (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
            {/* 左侧：现有藏品 */}
            <TouchableOpacity style={styles.addBtn} onPress={() => openItemForm()}>
              <Text style={styles.addBtnText}>+ 新增藏品</Text>
            </TouchableOpacity>

            {/* 搜索栏 + 稀有度筛选 */}
            <View style={styles.itemSearchBar}>
              <View style={styles.itemSearchInputRow}>
                <TextInput
                  style={styles.itemSearchInput}
                  placeholder="搜索藏品名称..."
                  placeholderTextColor={colors.textHint}
                  value={itemSearchKeyword}
                  onChangeText={handleItemSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {itemSearchKeyword !== "" && (
                  <TouchableOpacity
                    style={styles.itemSearchClear}
                    onPress={() => { setItemSearchKeyword(""); fetchItems("", itemSearchRarity); }}
                  >
                    <Text style={{ color: colors.textHint, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.itemRarityRow}>
                <TouchableOpacity
                  style={[styles.itemRarityChip, !itemSearchRarity && styles.itemRarityChipActive]}
                  onPress={() => handleItemRarityFilter(null)}
                >
                  <Text style={[styles.itemRarityChipText, !itemSearchRarity && styles.itemRarityChipTextActive]}>全部</Text>
                </TouchableOpacity>
                {RARITY_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.itemRarityChip, itemSearchRarity === r && { borderColor: RARITY_COLORS[r], backgroundColor: RARITY_COLORS[r] + "18" }]}
                    onPress={() => handleItemRarityFilter(itemSearchRarity === r ? null : r)}
                  >
                    <Text style={[styles.itemRarityChipText, itemSearchRarity === r && { color: RARITY_COLORS[r], fontWeight: "800" }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📦 现有藏品</Text>
              <Text style={styles.sectionCount}>{activeItems.length} 件</Text>
            </View>
            {activeItems.map((item) => (
              <View key={item._id} style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <Text style={styles.listItemName}>{item.name}</Text>
                  </View>
                  <RarityBadge rarity={item.rarity} size="sm" />
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => openItemForm(item)}><Text style={styles.editBtnText}>编辑</Text></TouchableOpacity>
                <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteItem(item)}><Text style={styles.delBtnText}>停用</Text></TouchableOpacity>
              </View>
            ))}
            {activeItems.length === 0 && <Text style={styles.emptyHint}>暂无活跃藏品</Text>}

            {/* 右侧：已停用藏品 */}
            {inactiveItems.length > 0 && (
              <>
                <View style={[styles.sectionHeader, { marginTop: spacing.xxl }]}>
                  <Text style={[styles.sectionTitle, { color: colors.error }]}>🛑 已停用</Text>
                  <Text style={styles.sectionCount}>{inactiveItems.length} 件</Text>
                </View>
                {inactiveItems.map((item) => (
                  <View key={item._id} style={[styles.listItem, styles.listItemInactive]}>
                    <View style={styles.listItemInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <Text style={styles.listItemName}>{item.name}</Text>
                        <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>已停用</Text></View>
                      </View>
                      <RarityBadge rarity={item.rarity} size="sm" />
                    </View>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openItemForm(item)}><Text style={styles.editBtnText}>编辑</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.success + "15" }]} onPress={async () => {
                      try { await reactivateItem(item._id); Alert.alert("✅", "藏品已恢复"); fetchAll(); }
                      catch (e: any) { Alert.alert("失败", e?.error || ""); }
                    }}>
                      <Text style={[styles.editBtnText, { color: colors.success }]}>恢复</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.delBtn, { backgroundColor: "#00000015" }]} onPress={() => {
                      Alert.alert("彻底删除", `确定要彻底删除"${item.name}"吗？此操作不可恢复。`, [
                        { text: "取消", style: "cancel" },
                        { text: "彻底删除", style: "destructive", onPress: async () => {
                          try { await permanentlyDeleteItem(item._id); Alert.alert("已删除"); fetchAll(); }
                          catch (e: any) { Alert.alert("失败", e?.error || ""); }
                        }},
                      ]);
                    }}>
                      <Text style={[styles.delBtnText, { color: "#333" }]}>彻底删除</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        );
      })()}

      {/* 宝箱发布 */}
      {tab === "chests" && (
        <ScrollView style={styles.chestPanel} contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
          <Text style={styles.chestTitle}>🗺️ 发布宝箱</Text>

          <Text style={styles.formLabel}>宝箱类型</Text>
          <View style={styles.chestTypeRow}>
            <TouchableOpacity style={[styles.chestTypeCard, chestType === "normal" && styles.chestTypeCardActive]} onPress={() => setChestType("normal")}>
              <Text style={styles.chestTypeEmoji}>📦</Text>
              <Text style={[styles.chestTypeLabel, chestType === "normal" && styles.chestTypeLabelActive]}>普通宝箱</Text>
              <Text style={styles.chestTypeHint}>单人 · 每小时1次</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.chestTypeCard, chestType === "advanced" && styles.chestTypeCardActive]} onPress={() => setChestType("advanced")}>
              <Text style={styles.chestTypeEmoji}>💎</Text>
              <Text style={[styles.chestTypeLabel, chestType === "advanced" && styles.chestTypeLabelActive]}>高级宝箱</Text>
              <Text style={styles.chestTypeHint}>2-4人协作 · 每天1次</Text>
            </TouchableOpacity>
          </View>

          {chestType === "advanced" && (
            <>
              <Text style={styles.formLabel}>所需人数</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg }}>
                {[1, 2, 3, 4].map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.campusCard, chestRequiredPlayers === n && styles.campusCardActive]}
                    onPress={() => setChestRequiredPlayers(n)}
                  >
                    <Text style={[styles.campusCardText, chestRequiredPlayers === n && { color: colors.primary }]}>{n}人</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.formLabel}>校区</Text>
          <View style={styles.campusRow}>
            <TouchableOpacity style={[styles.campusCard, chestCampus === "gulou" && styles.campusCardActive]} onPress={() => setChestCampus("gulou")}>
              <Text style={styles.campusCardText}>🏫 鼓楼</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.campusCard, chestCampus === "xianlin" && styles.campusCardActive]} onPress={() => setChestCampus("xianlin")}>
              <Text style={styles.campusCardText}>🏢 仙林</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.campusCard, chestCampus === "suzhou" && styles.campusCardActive]} onPress={() => setChestCampus("suzhou")}>
              <Text style={styles.campusCardText}>🏛️ 苏州</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formLabel}>宝箱位置</Text>
          <TouchableOpacity style={styles.mapPickBtn} onPress={() => {
            navigation.navigate("MapPicker", { campus: chestCampus, onSelect: (coord: any) => setChestCoord(coord) });
          }}>
            {chestCoord ? (
              <Text style={styles.mapPickDone}>✅ 已选择: {chestCoord.lat.toFixed(5)}, {chestCoord.lng.toFixed(5)} (点击修改)</Text>
            ) : (
              <Text style={styles.mapPickEmpty}>🗺️ 点击打开地图选择位置</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.createChestBtn, (!chestCoord || chestCreating) && styles.createChestBtnDisabled]} onPress={handleCreateChest} disabled={!chestCoord || chestCreating}>
            <Text style={styles.createChestBtnText}>{chestCreating ? "发布中..." : "📢 发布宝箱"}</Text>
          </TouchableOpacity>

          {/* 冷却时间设置 */}
          <View style={styles.boundsCard}>
            <Text style={{ ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md }}>⏳ 冷却时间（全局）</Text>
            <View style={{ flexDirection: "row", gap: spacing.lg }}>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>📦 普通宝箱</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((p: any) => ({ ...p, cdn: Math.max(0, (p.cdn ?? 1) - 1) }))}><Text style={styles.stepperBtnText}>−</Text></TouchableOpacity>
                  <Text style={{ ...typography.h3, color: colors.textPrimary, minWidth: 36, textAlign: "center" }}>{chestConfig.cdn ?? 1}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((p: any) => ({ ...p, cdn: Math.min(168, (p.cdn ?? 1) + 1) }))}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                  <Text style={{ ...typography.small, color: colors.textHint }}>h</Text>
                </View>
              </View>
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xs }}>💎 高级宝箱</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((p: any) => ({ ...p, cda: Math.max(0, (p.cda ?? 1) - 1) }))}><Text style={styles.stepperBtnText}>−</Text></TouchableOpacity>
                  <Text style={{ ...typography.h3, color: colors.textPrimary, minWidth: 36, textAlign: "center" }}>{chestConfig.cda ?? 1}</Text>
                  <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((p: any) => ({ ...p, cda: Math.min(168, (p.cda ?? 1) + 1) }))}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                  <Text style={{ ...typography.small, color: colors.textHint }}>h</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={[styles.createChestBtn, { marginTop: spacing.lg, backgroundColor: colors.rarity.典藏 }]} onPress={async () => {
              const nc = chestConfig.cdn ?? 1; const ac = chestConfig.cda ?? 1;
              await api.put("/admin/chest-config", { campus: "gulou", normalCooldownHours: nc, advancedCooldownHours: ac, maxNormalChests: chestConfig.gulou?.maxNormalChests ?? 3, advancedChance: chestConfig.gulou?.advancedChance ?? 0.2 });
              await api.put("/admin/chest-config", { campus: "xianlin", normalCooldownHours: nc, advancedCooldownHours: ac, maxNormalChests: chestConfig.xianlin?.maxNormalChests ?? 3, advancedChance: chestConfig.xianlin?.advancedChance ?? 0.2 });
              Alert.alert("✅", "冷却时间已保存");
            }}>
              <Text style={styles.createChestBtnText}>💾 保存冷却时间</Text>
            </TouchableOpacity>
          </View>

          {/* 宝箱刷新配置 */}
          <View style={{ marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}>
            <Text style={styles.chestTitle}>⚙️ 自动刷新设置</Text>
            <Text style={{ ...typography.caption, color: colors.textHint, marginBottom: spacing.md }}>每5分钟检查，宝箱不足时自动补充</Text>
            {["gulou", "xianlin", "suzhou"].map((c) => {
              const label = c === "gulou" ? "🏫 鼓楼" : c === "xianlin" ? "🏢 仙林" : "🏛️ 苏州";
              const cfg = chestConfig[c] || { maxNormalChests: 3, advancedChance: 0.2 };
              return (
                <View key={c} style={styles.boundsCard}>
                  <Text style={styles.boundsTitle}>{label}</Text>
                  <View style={{ flexDirection: "row", gap: spacing.md }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>宝箱数量</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((prev: any) => ({ ...prev, [c]: { ...prev[c], maxNormalChests: Math.max(0, (prev[c]?.maxNormalChests ?? 3) - 1) } }))}><Text style={styles.stepperBtnText}>−</Text></TouchableOpacity>
                        <Text style={{ ...typography.h3, color: colors.textPrimary, minWidth: 30, textAlign: "center" }}>{cfg.maxNormalChests ?? 3}</Text>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((prev: any) => ({ ...prev, [c]: { ...prev[c], maxNormalChests: Math.min(10, (prev[c]?.maxNormalChests ?? 3) + 1) } }))}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formLabel}>高级概率</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((prev: any) => ({ ...prev, [c]: { ...prev[c], advancedChance: Math.max(0, (prev[c]?.advancedChance ?? 0.2) - 0.05) } }))}><Text style={styles.stepperBtnText}>−</Text></TouchableOpacity>
                        <Text style={{ ...typography.h3, color: colors.textPrimary, minWidth: 40, textAlign: "center" }}>{Math.round((cfg.advancedChance ?? 0.2) * 100)}%</Text>
                        <TouchableOpacity style={styles.stepperBtn} onPress={() => setChestConfig((prev: any) => ({ ...prev, [c]: { ...prev[c], advancedChance: Math.min(1, (prev[c]?.advancedChance ?? 0.2) + 0.05) } }))}><Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
            <TouchableOpacity style={[styles.createChestBtn, { backgroundColor: colors.info, marginTop: spacing.sm }]} onPress={async () => {
              try {
                for (const c of ["gulou", "xianlin", "suzhou"]) {
                  const cfg = chestConfig[c] || { maxNormalChests: 3, advancedChance: 0.2, normalCooldownHours: 1, advancedCooldownHours: 1 };
                  await api.put("/admin/chest-config", { campus: c, maxNormalChests: cfg.maxNormalChests ?? 3, advancedChance: cfg.advancedChance ?? 0.2, normalCooldownHours: cfg.normalCooldownHours ?? 1, advancedCooldownHours: cfg.advancedCooldownHours ?? 1 });
                }
                Alert.alert("✅", "宝箱配置已保存，将在下次补充时生效");
              } catch (e: any) { Alert.alert("失败", e?.error || ""); }
            }}>
              <Text style={styles.createChestBtnText}>💾 保存刷新设置</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.createChestBtn, { backgroundColor: colors.warning, marginTop: spacing.md, shadowColor: colors.warning }]}
            onPress={async () => {
              Alert.alert("确认刷新", "将清空两个校区的所有宝箱，并依据当前校区边界重新生成。确认？", [
                { text: "取消", style: "cancel" },
                { text: "确认刷新", style: "destructive", onPress: async () => {
                  try { const res = await api.post("/admin/refresh-chests"); Alert.alert("✅", (res as any).message || "刷新完成"); fetchAll(); }
                  catch (e: any) { Alert.alert("失败", e?.error || ""); }
                }},
              ]);
            }}
          >
            <Text style={styles.createChestBtnText}>🔄 一键刷新全部宝箱</Text>
          </TouchableOpacity>

          {/* 爆率调整 */}
          <View style={{ marginTop: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }}>
            <Text style={styles.chestTitle}>🎲 爆率调整</Text>
            {(["normal", "advanced"] as const).map((ct) => (
              <View key={ct} style={styles.boundsCard}>
                <Text style={styles.boundsTitle}>{ct === "normal" ? "📦 普通宝箱" : "💎 高级宝箱"}</Text>
                {(["典藏","神秘","限定","高端","普通","常见"] as string[]).map((r) => {
                  const val = dropConfig[ct]?.[r] ?? (ct === "normal" ? {典藏:4,神秘:1.5,限定:4,高端:12,普通:30,常见:48.5} : {典藏:20,神秘:10,限定:20,高端:50,普通:0,常见:0})[r];
                  return (
                    <View key={r} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4, gap: spacing.sm }}>
                      <Text style={{ width: 40, ...typography.small, color: RARITY_COLORS[r] || "#999", fontWeight: "700" }}>{r}</Text>
                      <View style={{ flex: 1, height: 6, backgroundColor: colors.divider, borderRadius: 3, overflow: "hidden" }}>
                        <View style={{ height: 6, width: Math.min(100, (val/50)*100) + "%", backgroundColor: RARITY_COLORS[r] || "#999", borderRadius: 3 }} />
                      </View>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setDropConfig((prev:any) => ({ ...prev, [ct]: { ...prev[ct], [r]: Math.max(0, (prev[ct]?.[r] ?? val) - 0.5) } }))}>
                        <Text style={styles.stepperBtnText}>−</Text></TouchableOpacity>
                      <Text style={{ width: 36, textAlign: "center", ...typography.small, fontWeight: "700" }}>{val}</Text>
                      <TouchableOpacity style={styles.stepperBtn} onPress={() => setDropConfig((prev:any) => ({ ...prev, [ct]: { ...prev[ct], [r]: Math.min(100, (prev[ct]?.[r] ?? val) + 0.5) } }))}>
                        <Text style={styles.stepperBtnText}>+</Text></TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))}
            <TouchableOpacity style={[styles.createChestBtn, { backgroundColor: colors.rarity.典藏, marginTop: spacing.sm }]} onPress={async () => {
              try {
                for (const ct of ["normal", "advanced"]) {
                  await api.put("/admin/drop-config", { chestType: ct, weights: dropConfig[ct] || {} });
                }
                Alert.alert("✅", "爆率已保存，新生成的宝箱生效");
              } catch (e: any) { Alert.alert("失败", e?.error || ""); }
            }}>
              <Text style={styles.createChestBtnText}>💾 保存爆率</Text>
            </TouchableOpacity>
          </View>

          {activeChests.length > 0 && (
            <View style={{ marginTop: spacing.xl }}>
              <Text style={{ ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm }}>活跃宝箱 ({activeChests.length})</Text>
              {(["gulou", "xianlin", "suzhou"] as const).map((campus) => {
                const campusChests = activeChests.filter((c: any) => c.campus === campus);
                if (campusChests.length === 0) return null;
                return (
                  <View key={campus} style={{ marginBottom: spacing.md }}>
                    <Text style={{ ...typography.caption, fontWeight: "800", color: colors.primary, marginBottom: spacing.xs }}>{campus === "gulou" ? "🏫 鼓楼校区" : campus === "xianlin" ? "🏢 仙林校区" : "🏛️ 苏州校区"} ({campusChests.length})</Text>
                    {campusChests.map((c: any, idx: number) => (
                      <View key={c._id} style={styles.chestListItem}>
                        <Text style={{ fontSize: 20 }}>{c.type === "advanced" ? "💎" : "📦"}</Text>
                        <View style={{ flex: 1, marginLeft: spacing.sm }}>
                          <Text style={{ ...typography.caption, fontWeight: "600" }}>{c.type === "advanced" ? "高级" : "普通"}宝箱 #{idx + 1}</Text>
                          <Text style={{ ...typography.small, color: colors.textHint, fontSize: 9 }}>{c.coordinates.lat.toFixed(5)}, {c.coordinates.lng.toFixed(5)}</Text>
                        </View>
                        <TouchableOpacity style={styles.delBtn} onPress={() => handleRemoveChest(c._id)}><Text style={styles.delBtnText}>删除</Text></TouchableOpacity>
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* 赠送藏品 */}
      {tab === "gift" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }}>
          {/* 自动消失Toast */}
          {giftToast !== "" && (
            <View style={[styles.giftToast, giftToast.startsWith("❌") ? { backgroundColor: colors.error } : giftToast.startsWith("⚠️") ? { backgroundColor: colors.warning } : { backgroundColor: colors.success }]}>
              <Text style={styles.giftToastText}>{giftToast}</Text>
            </View>
          )}

          <Text style={styles.chestTitle}>🎁 赠送藏品</Text>
          <Text style={{ ...typography.caption, color: colors.textHint, marginBottom: spacing.md }}>
            输入用户数字ID，选择多个藏品一次性赠送给用户（含已绝版）
          </Text>
          <Text style={styles.formLabel}>用户数字ID</Text>
          <TextInput style={styles.formInput} value={giftUserId} onChangeText={setGiftUserId} placeholder="例如: 10001" placeholderTextColor={colors.textHint} keyboardType="number-pad" />

          <Text style={styles.formLabel}>已选藏品（{giftItemIds.length} 件）</Text>
          <TouchableOpacity style={styles.mapPickBtn} onPress={async () => {
            if (!giftUserId.trim()) {
              setGiftToast("⚠️ 请先输入用户数字ID");
              setTimeout(() => setGiftToast(""), 2000);
              return;
            }
            setGiftSelectedIds([...giftItemIds]);
            setGiftSearchKeyword("");
            setGiftSearchRarity(null);
            try {
              const r = await getUserItemCounts(Number(giftUserId.trim()));
              if (r.success) setGiftUserCounts(r.data!);
              setShowGiftPicker(true);
            } catch (e: any) {
              setGiftUserCounts({});
              if (e?.error?.includes("用户不存在") || e?.error?.includes("未找到")) {
                setGiftToast("❌ 用户ID不存在，请重新输入");
                setTimeout(() => setGiftToast(""), 2500);
              } else {
                setShowGiftPicker(true); // 网络错误仍然可以选，但不显示持有量
              }
            }
          }}>
            {giftItemIds.length > 0 ? (
              <View>
                {giftItemIds.map((id) => {
                  const it = allItems.find((i) => i._id === id) || items.find((i) => i._id === id);
                  return it ? (
                    <Text key={id} style={{ ...typography.small, color: colors.primary, marginBottom: 2 }}>
                      ✅ {it.name}（{it.rarity}）
                      <Text style={{ color: colors.error, fontWeight: "700" }} onPress={() => setGiftItemIds((prev) => prev.filter((x) => x !== id))}>  ✕移除</Text>
                    </Text>
                  ) : null;
                })}
                <Text style={{ ...typography.small, color: colors.textHint, marginTop: spacing.xs }}>点击添加更多</Text>
              </View>
            ) : (
              <Text style={styles.mapPickEmpty}>🎁 点击从藏品列表中选择（可多选）</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.createChestBtn, { marginTop: spacing.md }, (!giftUserId.trim() || giftItemIds.length === 0 || gifting) && styles.createChestBtnDisabled]}
            onPress={async () => {
              if (!giftUserId.trim() || giftItemIds.length === 0) return;
              setGifting(true);
              try {
                await giftItem(Number(giftUserId.trim()), giftItemIds);
                setGiftToast(`✅ 已成功赠送 ${giftItemIds.length} 件藏品！`);
                setTimeout(() => setGiftToast(""), 2000);
                setGiftUserId(""); setGiftItemIds([]);
              } catch (e: any) { setGiftToast("❌ " + (e?.error || "赠送失败")); setTimeout(() => setGiftToast(""), 3000); }
              finally { setGifting(false); }
            }}
            disabled={!giftUserId.trim() || giftItemIds.length === 0 || gifting}
          >
            <Text style={styles.createChestBtnText}>{gifting ? "赠送中..." : `🎁 确认赠送（${giftItemIds.length}件）`}</Text>
          </TouchableOpacity>

          {/* 藏品多选弹窗 */}
          <Modal visible={showGiftPicker} transparent animationType="slide" onRequestClose={() => setShowGiftPicker(false)}>
            <View style={styles.modalOverlay}>
              <View style={[styles.modalCard, { maxHeight: "80%" }]}>
                <View style={{ padding: spacing.lg, paddingBottom: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
                    <Text style={{ ...typography.h3 }}>🎁 选择藏品（多选）</Text>
                    <TouchableOpacity onPress={() => setShowGiftPicker(false)}><Text style={{ ...typography.h2, color: colors.primary }}>✕</Text></TouchableOpacity>
                  </View>
                  <Text style={{ ...typography.small, color: colors.textHint, marginBottom: spacing.sm }}>
                    已选 {giftSelectedIds.length} 件 · 点击藏品切换选中状态
                  </Text>

                  {/* ── 搜索 + 分类（紧凑顶部栏） ── */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                    <TextInput
                      style={[styles.formInput, { flex: 1, marginBottom: 0, paddingVertical: 6 }]}
                      placeholder="关键词搜索..."
                      placeholderTextColor={colors.textHint}
                      value={giftSearchKeyword}
                      onChangeText={setGiftSearchKeyword}
                      autoCorrect={false}
                    />
                    {giftSearchKeyword !== "" && (
                      <TouchableOpacity onPress={() => setGiftSearchKeyword("")}>
                        <Text style={{ color: colors.textHint, fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
                    <TouchableOpacity
                      style={[styles.itemRarityChip, !giftSearchRarity && styles.itemRarityChipActive]}
                      onPress={() => setGiftSearchRarity(null)}
                    >
                      <Text style={[styles.itemRarityChipText, !giftSearchRarity && styles.itemRarityChipTextActive]}>全部</Text>
                    </TouchableOpacity>
                    {RARITY_OPTIONS.map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[styles.itemRarityChip, giftSearchRarity === r && styles.itemRarityChipActive]}
                        onPress={() => setGiftSearchRarity(giftSearchRarity === r ? null : r)}
                      >
                        <Text style={[styles.itemRarityChipText, giftSearchRarity === r && styles.itemRarityChipTextActive]}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <FlatList
                    data={allItems.filter((item) => {
                      if (giftSearchRarity && item.rarity !== giftSearchRarity) return false;
                      if (giftSearchKeyword.trim()) {
                        const kw = giftSearchKeyword.trim().toLowerCase();
                        return item.name.toLowerCase().includes(kw) || item.rarity.toLowerCase().includes(kw);
                      }
                      return true;
                    })}
                    style={{ flex: 1, minHeight: 0 }}
                    keyExtractor={(i) => i._id}
                    renderItem={({ item }) => {
                      const isSel = giftSelectedIds.includes(item._id);
                      const hasCount = (giftUserCounts[item._id] || 0) > 0;
                      return (
                        <TouchableOpacity
                          style={[
                            styles.listItem,
                            isSel && { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primary + "0A" },
                            hasCount && { opacity: 0.55 },
                          ]}
                          onPress={() => setGiftSelectedIds((prev) => prev.includes(item._id) ? prev.filter((x) => x !== item._id) : [...prev, item._id])}
                        >
                          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: isSel ? colors.primary : colors.border, backgroundColor: isSel ? colors.primary : "transparent", marginRight: spacing.sm, alignItems: "center", justifyContent: "center" }}>
                            {isSel && <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "900" }}>✓</Text>}
                          </View>
                          <View style={styles.listItemInfo}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                              <Text style={[styles.listItemName, hasCount && { color: colors.textHint }]}>{item.name}</Text>
                              {!item.isActive && <View style={styles.inactiveBadge}><Text style={styles.inactiveBadgeText}>已绝版</Text></View>}
                              {hasCount && (
                                <View style={{ backgroundColor: colors.surfaceAlt, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 }}>
                                  <Text style={{ ...typography.small, color: colors.textHint, fontSize: 10 }}>已拥有</Text>
                                </View>
                              )}
                              {!hasCount && (
                                <View style={{ backgroundColor: colors.primary + "15", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 }}>
                                  <Text style={{ ...typography.small, color: colors.primary, fontWeight: "700", fontSize: 10 }}>未拥有</Text>
                                </View>
                              )}
                            </View>
                            <RarityBadge rarity={item.rarity} size="sm" />
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                    ListEmptyComponent={<EmptyState emoji="🎁" title="暂无藏品" />}
                  />
                  <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.md, paddingBottom: spacing.lg }}>
                    <TouchableOpacity style={[styles.saveFormBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={() => { setGiftItemIds([...giftSelectedIds]); setShowGiftPicker(false); }}>
                      <Text style={styles.saveFormBtnText}>确认（{giftSelectedIds.length}件）</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cancelBtn, { flex: 1 }]} onPress={() => { setShowGiftPicker(false); }}>
                      <Text style={styles.cancelBtnText}>取消</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        </ScrollView>
      )}

      {/* 反馈列表 */}
      {tab === "feedback" && (
        <View style={{ flex: 1 }}>
          {/* 筛选 */}
          <View style={styles.feedbackFilterRow}>
            {(["pending", "resolved", "all"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.feedbackFilterBtn, feedbackFilter === f && styles.feedbackFilterBtnActive]}
                onPress={() => setFeedbackFilter(f)}
              >
                <Text style={[styles.feedbackFilterText, feedbackFilter === f && styles.feedbackFilterTextActive]}>
                  {f === "pending" ? "⏳ 待处理" : f === "resolved" ? "✅ 已处理" : "📋 全部"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={feedbacks}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const user = item.userId;
              const isReplying = replyingTo === item._id;
              return (
                <View style={[styles.feedbackCard, item.status === "resolved" && { opacity: 0.75 }]}>
                  <View style={styles.feedbackCardHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Text style={styles.feedbackUserIcon}>👤</Text>
                      <View>
                        <Text style={styles.feedbackUserName}>{user?.nickname || "未知用户"}</Text>
                        <Text style={styles.feedbackUserMeta}>
                          ID: {user?.userId || "?"} · {user?.email || ""}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Text style={styles.feedbackDate}>
                        {new Date(item.createdAt).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                      <View style={[styles.fbStatusBadge, { backgroundColor: item.status === "pending" ? colors.warning + "20" : colors.success + "20" }]}>
                        <Text style={[styles.fbStatusText, { color: item.status === "pending" ? colors.warning : colors.success }]}>
                          {item.status === "pending" ? "待处理" : "已处理"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <Text style={styles.feedbackContent}>{item.content}</Text>

                  {item.adminReply ? (
                    <View style={styles.fbReplyBox}>
                      <Text style={styles.fbReplyLabel}>👑 我的回复：</Text>
                      <Text style={styles.fbReplyContent}>{item.adminReply}</Text>
                    </View>
                  ) : null}

                  {item.status === "pending" && (
                    <>
                      {isReplying ? (
                        <View style={styles.fbReplyInputWrap}>
                          <TextInput
                            style={styles.fbReplyInput}
                            placeholder="输入回复内容（可选）..."
                            placeholderTextColor={colors.textHint}
                            value={replyContent}
                            onChangeText={setReplyContent}
                            multiline
                          />
                          <View style={styles.fbReplyBtns}>
                            <TouchableOpacity
                              style={styles.fbCancelBtn}
                              onPress={() => { setReplyingTo(null); setReplyContent(""); }}
                            >
                              <Text style={styles.fbCancelBtnText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.fbResolveSmallBtn}
                              onPress={async () => {
                                try {
                                  await resolveFeedback(item._id, { status: "resolved", adminReply: replyContent.trim() });
                                  Alert.alert("✅", "已标记为已处理");
                                  setReplyingTo(null); setReplyContent("");
                                  fetchAll();
                                } catch (e: any) { Alert.alert("失败", e?.error || ""); }
                              }}
                            >
                              <Text style={styles.fbResolveSmallText}>确认处理</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.fbResolveBtn}
                          onPress={() => setReplyingTo(item._id)}
                        >
                          <Text style={styles.fbResolveBtnText}>✅ 标记为已处理</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  {item.resolvedBy && (
                    <Text style={styles.fbResolvedMeta}>
                      由 {(item.resolvedBy as any)?.nickname || "管理员"} 处理于{" "}
                      {item.resolvedAt
                        ? new Date(item.resolvedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </Text>
                  )}
                </View>
              );
            }}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState emoji="📭" title="暂无反馈" subtitle={feedbackFilter === "pending" ? "所有反馈都已处理" : "还没有用户提交反馈"} />
            }
          />
        </View>
      )}

      {/* 举报列表 */}
      {tab === "reports" && (
        <View style={{ flex: 1 }}>
          <View style={styles.feedbackFilterRow}>
            {(["pending", "resolved", "dismissed", "all"] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.feedbackFilterBtn, reportFilter === f && styles.feedbackFilterBtnActive]}
                onPress={() => setReportFilter(f)}
              >
                <Text style={[styles.feedbackFilterText, reportFilter === f && styles.feedbackFilterTextActive]}>
                  {f === "pending" ? "⏳ 待处理" : f === "resolved" ? "✅ 已处理" : f === "dismissed" ? "🚫 已驳回" : "📋 全部"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={reports}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const reporter = item.reporterId;
              const isBanning = banningReportId === item._id;
              return (
                <View style={[styles.feedbackCard, item.status !== "pending" && { opacity: 0.75 }]}>
                  <View style={styles.feedbackCardHeader}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Text style={styles.feedbackUserIcon}>🚩</Text>
                      <View>
                        <Text style={styles.feedbackUserName}>{reporter?.nickname || "未知用户"} 举报了 {item.targetType === "user" ? "用户" : "活动"}</Text>
                        <Text style={styles.feedbackUserMeta}>目标ID: {item.targetId}</Text>
                      </View>
                    </View>
                    <View style={[styles.fbStatusBadge, { backgroundColor: item.status === "pending" ? colors.warning + "20" : item.status === "resolved" ? colors.success + "20" : colors.error + "20" }]}>
                      <Text style={[styles.fbStatusText, { color: item.status === "pending" ? colors.warning : item.status === "resolved" ? colors.success : colors.error }]}>
                        {item.status === "pending" ? "待处理" : item.status === "resolved" ? "已处理" : "已驳回"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.feedbackContent}>{item.reason}</Text>

                  {item.status === "pending" && (
                    <>
                      {isBanning ? (
                        <View style={styles.fbReplyInputWrap}>
                          <TextInput
                            style={styles.fbReplyInput}
                            placeholder="封禁原因..."
                            placeholderTextColor={colors.textHint}
                            value={banReasonInput}
                            onChangeText={setBanReasonInput}
                          />
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm }}>
                            <Text style={{ ...typography.caption, color: colors.textSecondary }}>封禁天数（0=永久）</Text>
                            <TextInput
                              style={[styles.formInput, { width: 70, marginBottom: 0, paddingVertical: 4 }]}
                              value={banDays}
                              onChangeText={setBanDays}
                              keyboardType="number-pad"
                            />
                          </View>
                          <View style={styles.fbReplyBtns}>
                            <TouchableOpacity style={styles.fbCancelBtn} onPress={() => { setBanningReportId(null); setBanDays("0"); setBanReasonInput(""); }}>
                              <Text style={styles.fbCancelBtnText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.fbResolveSmallBtn, { backgroundColor: colors.error }, banSubmitting && { opacity: 0.6 }]}
                              onPress={() => handleBanUser(item.targetId)}
                              disabled={banSubmitting}
                            >
                              <Text style={styles.fbResolveSmallText}>{banSubmitting ? "处理中..." : "确认封禁"}</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <View style={{ flexDirection: "row", gap: spacing.sm }}>
                          {item.targetType === "user" && (
                            <TouchableOpacity style={[styles.fbResolveBtn, { flex: 1, borderColor: colors.error + "50" }]} onPress={() => setBanningReportId(item._id)}>
                              <Text style={[styles.fbResolveBtnText, { color: colors.error }]}>🔒 封禁用户</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={[styles.fbResolveBtn, { flex: 1 }]} onPress={() => handleResolveReport(item._id, "resolved")}>
                            <Text style={styles.fbResolveBtnText}>✅ 标记已处理</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.fbCancelBtn, { flex: 1 }]} onPress={() => handleResolveReport(item._id, "dismissed")}>
                            <Text style={styles.fbCancelBtnText}>驳回</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}

                  {item.handledBy && (
                    <Text style={styles.fbResolvedMeta}>
                      由 {(item.handledBy as any)?.nickname || "管理员"} 处理于{" "}
                      {item.handledAt
                        ? new Date(item.handledAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </Text>
                  )}
                </View>
              );
            }}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <EmptyState emoji="🚩" title="暂无举报" subtitle={reportFilter === "pending" ? "所有举报都已处理" : "还没有用户提交举报"} />
            }
          />
        </View>
      )}

      {/* 活动类型列表 */}
      {tab === "eventTypes" && (
        <>
          <TouchableOpacity style={styles.addBtn} onPress={() => openTypeForm()}>
            <Text style={styles.addBtnText}>+ 新增类型</Text>
          </TouchableOpacity>
          <FlatList
            data={types}
            keyExtractor={(t) => t._id}
            renderItem={({ item }) => (
              <View style={styles.listItem}>
                <View style={styles.listItemInfo}>
                  <Text style={styles.listItemName}>{item.name}</Text>
                  <Text style={styles.listItemSub}>排序: {item.sortOrder}</Text>
                </View>
                <TouchableOpacity style={styles.editBtn} onPress={() => openTypeForm(item)}><Text style={styles.editBtnText}>编辑</Text></TouchableOpacity>
                <TouchableOpacity style={styles.delBtn} onPress={() => handleDeleteType(item)}><Text style={styles.delBtnText}>删除</Text></TouchableOpacity>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<EmptyState emoji="🏷️" title="暂无活动类型" subtitle="点击上方新增" />}
          />
        </>
      )}

      {/* ── 表单弹窗 ── */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalCard} contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>
              {isItemForm ? (editingItem ? "✏️ 编辑藏品" : "🎁 新增藏品") : (editingType ? "✏️ 编辑活动类型" : "🏷️ 新增活动类型")}
            </Text>

            <Text style={styles.formLabel}>名称</Text>
            <TextInput style={styles.formInput} value={formName} onChangeText={setFormName} placeholder="输入名称" placeholderTextColor={colors.textHint} />

            {isItemForm && (
              <>
                <Text style={styles.formLabel}>描述</Text>
                <TextInput style={[styles.formInput, styles.formTextarea]} value={formDesc} onChangeText={setFormDesc} placeholder="输入描述" placeholderTextColor={colors.textHint} multiline />

                <Text style={styles.formLabel}>稀有度</Text>
                <View style={styles.rarityRow}>
                  {RARITY_OPTIONS.map((r) => (
                    <TouchableOpacity key={r} style={[styles.rarityOpt, formRarity === r && { backgroundColor: RARITY_COLORS[r] + "20", borderColor: RARITY_COLORS[r] }]}
                      onPress={() => setFormRarity(r)}>
                      <Text style={[styles.rarityOptText, { color: RARITY_COLORS[r] || "#999" }]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.formLabel}>藏品图片</Text>
                {formImageUrl ? (
                  <View style={{ alignItems: "center", marginBottom: spacing.md }}>
                    <Image source={{ uri: fixImageUrl(formImageUrl) }} style={{ width: 120, height: 120, borderRadius: borderRadius.md, marginBottom: spacing.sm }} />
                    <TouchableOpacity onPress={() => setFormImageUrl("")}><Text style={{ color: colors.error, fontWeight: "600" }}>移除图片</Text></TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadBtn} onPress={pickImage} disabled={uploading}>
                    <Text style={styles.uploadBtnText}>{uploading ? "上传中..." : "📷 从相册选择图片"}</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.formLabel}>掉落权重</Text>
                <TextInput style={styles.formInput} value={formDropWeight} onChangeText={setFormDropWeight} keyboardType="decimal-pad" placeholder="1.0" placeholderTextColor={colors.textHint} />
              </>
            )}

            {isTypeForm && (
              <>
                <Text style={styles.formLabel}>图标颜色</Text>
                <View style={styles.colorGrid}>
                  {COLOR_PRESETS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorDot, { backgroundColor: c }, formColor === c && styles.colorDotSelected]}
                      onPress={() => setFormColor(c)}
                    />
                  ))}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
                  <View style={[styles.colorPreview, { backgroundColor: formColor }]} />
                  <Text style={{ ...typography.caption, color: colors.textSecondary }}>{formColor}</Text>
                </View>
                <Text style={styles.formLabel}>图标URL</Text>
                <TextInput style={styles.formInput} value={formIconUrl} onChangeText={setFormIconUrl} placeholder="https://..." placeholderTextColor={colors.textHint} />
                <Text style={styles.formLabel}>排序序号</Text>
                <TextInput style={styles.formInput} value={formSortOrder} onChangeText={setFormSortOrder} keyboardType="number-pad" />
              </>
            )}

            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveFormBtn, saving && { opacity: 0.6 }]} onPress={isItemForm ? handleSaveItem : handleSaveType} disabled={saving}>
                <Text style={styles.saveFormBtnText}>{saving ? "保存中..." : "保存"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const COLOR_PRESETS = [
  "#E74C3C", "#E91E63", "#FF6B6B", "#FF5722", "#FF9800", "#F39C12", "#FFD93D", "#FFEB3B",
  "#4CAF50", "#27AE60", "#8BC34A", "#00BCD4", "#3498DB", "#2196F3", "#3F51B5", "#9B59B6",
  "#9C27B0", "#673AB7", "#795548", "#607D8B", "#546E7A", "#37474F", "#FF4081", "#00E5FF",
  "#76FF03", "#FFD740", "#FF6E40", "#EA80FC", "#448AFF", "#69F0AE", "#FF1744", "#F50057",
];

const RARITY_COLORS: Record<string, string> = {
  "典藏": "#9B59B6", "神秘": "#FF6B6B", "限定": "#E74C3C", "高端": "#F39C12", "普通": "#3498DB", "常见": "#27AE60",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  loadingText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  header: {
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface, borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 6, zIndex: 10,
  },
  headerTitle: { fontFamily: HAND, fontSize: 24, color: colors.rarity.典藏 },
  tabRow: {
    flexDirection: "row", backgroundColor: colors.surface, margin: spacing.md,
    borderRadius: borderRadius.lg, padding: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 2,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: "center" },
  tabActive: { backgroundColor: colors.rarity.典藏 + "15" },
  tabText: { ...typography.bodyBold, color: colors.textSecondary },
  tabTextActive: { color: colors.rarity.典藏 },
  dashboard: { flexDirection: "row", padding: spacing.md, gap: spacing.md },
  dashCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 2,
  },
  dashNumber: { ...typography.h1, color: colors.rarity.典藏, fontSize: 32 },
  dashLabel: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  addBtn: {
    backgroundColor: colors.rarity.典藏, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: "center",
  },
  addBtnText: { ...typography.bodyBold, color: "#FFF" },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary, fontSize: 16 },
  sectionCount: { ...typography.caption, color: colors.textHint },
  emptyHint: { ...typography.caption, color: colors.textHint, textAlign: "center", padding: spacing.xl },
  listItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  listItemInactive: { opacity: 0.6, backgroundColor: colors.surfaceAlt },
  inactiveBadge: { backgroundColor: colors.error + "15", paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 8 },
  inactiveBadgeText: { ...typography.small, color: colors.error, fontWeight: "600", fontSize: 10 },
  listItemInfo: { flex: 1, gap: spacing.xs },
  listItemName: { ...typography.bodyBold, color: colors.textPrimary },
  listItemSub: { ...typography.caption, color: colors.textHint },
  editBtn: { backgroundColor: colors.info + "15", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm },
  editBtnText: { ...typography.caption, fontWeight: "600", color: colors.info },
  delBtn: { backgroundColor: colors.error + "15", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  delBtnText: { ...typography.caption, fontWeight: "600", color: colors.error },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl + 8, borderTopRightRadius: borderRadius.xl + 8, maxHeight: "85%" },
  modalContent: { padding: spacing.xxl },
  modalTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xl, textAlign: "center" },
  formLabel: { ...typography.caption, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  formInput: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary },
  formTextarea: { minHeight: 80, paddingTop: spacing.sm },
  rarityRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  rarityOpt: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, borderWidth: 1.5, borderColor: colors.border },
  rarityOptText: { ...typography.caption, fontWeight: "700" },
  formBtns: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xxl },
  cancelBtn: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.xl, paddingVertical: spacing.md, alignItems: "center" },
  cancelBtnText: { ...typography.button, color: colors.textSecondary },
  saveFormBtn: { flex: 1, backgroundColor: colors.rarity.典藏, borderRadius: borderRadius.xl, paddingVertical: spacing.md, alignItems: "center" },
  saveFormBtnText: { ...typography.button, color: "#FFF" },
  // 宝箱发布
  chestPanel: { flex: 1 },
  chestTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.lg },
  chestTypeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  chestTypeCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    alignItems: "center", borderWidth: 2, borderColor: colors.border,
  },
  chestTypeCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + "08" },
  chestTypeEmoji: { fontSize: 36, marginBottom: spacing.sm },
  chestTypeLabel: { ...typography.bodyBold, color: colors.textSecondary },
  chestTypeLabelActive: { color: colors.primary },
  chestTypeHint: { ...typography.small, color: colors.textHint, marginTop: spacing.xs },
  campusRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  campusCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, paddingVertical: spacing.md,
    alignItems: "center", borderWidth: 2, borderColor: colors.border,
  },
  campusCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + "08" },
  campusCardText: { ...typography.bodyBold, color: colors.textSecondary },
  mapPickBtn: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: "dashed", marginBottom: spacing.lg,
  },
  mapPickDone: { ...typography.body, color: colors.success, textAlign: "center" },
  mapPickEmpty: { ...typography.body, color: colors.primary, textAlign: "center", fontWeight: "600" },
  createChestBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.xl, paddingVertical: spacing.lg, alignItems: "center",
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  createChestBtnDisabled: { opacity: 0.5 },
  createChestBtnText: { ...typography.button, color: "#FFF", fontSize: 17 },
  chestListItem: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surface,
    borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm,
  },
  // 校区边界
  boundsCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md },
  boundsTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.md },
  boundsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  boundsField: { flex: 1 },
  boundsLabel: { ...typography.small, color: colors.textSecondary, marginBottom: spacing.xs },
  boundsInput: {
    ...typography.body, backgroundColor: colors.background, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm,
    color: colors.textPrimary, textAlign: "center", fontSize: 14,
  },
  uploadBtn: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 2, borderColor: colors.primary + "40",
    borderStyle: "dashed", paddingVertical: spacing.xxl, alignItems: "center", marginBottom: spacing.md,
  },
  uploadBtnText: { ...typography.bodyBold, color: colors.primary },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  colorDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: "transparent" },
  colorDotSelected: { borderColor: "#000", transform: [{ scale: 1.2 }] },
  colorPreview: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  // 反馈样式
  feedbackFilterRow: { flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  feedbackFilterBtn: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, alignItems: "center", borderWidth: 1.5, borderColor: colors.border },
  feedbackFilterBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "10" },
  feedbackFilterText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
  feedbackFilterTextActive: { color: colors.primary },
  feedbackCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg,
    marginBottom: spacing.sm, marginHorizontal: spacing.md,
  },
  feedbackCardHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  feedbackUserIcon: { fontSize: 28 },
  feedbackUserName: { ...typography.bodyBold, color: colors.textPrimary },
  feedbackUserMeta: { ...typography.small, color: colors.textHint, fontSize: 10 },
  feedbackDate: { ...typography.small, color: colors.textHint },
  fbStatusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  fbStatusText: { ...typography.small, fontWeight: "700", fontSize: 10 },
  feedbackContent: { ...typography.body, color: colors.textPrimary, lineHeight: 22, marginBottom: spacing.sm },
  fbReplyBox: {
    backgroundColor: colors.success + "10", borderRadius: borderRadius.md, padding: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.success, marginBottom: spacing.sm,
  },
  fbReplyLabel: { ...typography.caption, fontWeight: "700", color: colors.success, marginBottom: spacing.xs },
  fbReplyContent: { ...typography.body, color: colors.textPrimary },
  fbReplyInputWrap: { marginTop: spacing.sm },
  fbReplyInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, ...typography.body, color: colors.textPrimary,
    minHeight: 60, marginBottom: spacing.sm,
  },
  fbReplyBtns: { flexDirection: "row", gap: spacing.sm },
  fbCancelBtn: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, alignItems: "center" },
  fbCancelBtnText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
  fbResolveSmallBtn: { flex: 1, backgroundColor: colors.success, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, alignItems: "center" },
  fbResolveSmallText: { ...typography.caption, fontWeight: "700", color: "#FFF" },
  fbResolveBtn: {
    backgroundColor: colors.success + "15", borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm, alignItems: "center", borderWidth: 1.5, borderColor: colors.success + "50",
  },
  fbResolveBtnText: { ...typography.caption, fontWeight: "700", color: colors.success },
  fbResolvedMeta: { ...typography.small, color: colors.textHint, marginTop: spacing.sm, fontStyle: "italic" },
  // Toast
  giftToast: {
    backgroundColor: colors.success, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    marginBottom: spacing.md, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  giftToastText: { ...typography.bodyBold, color: "#FFF" },
  // 藏品搜索
  itemSearchBar: { paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  itemSearchInputRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.sm },
  itemSearchInput: {
    flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, ...typography.body, color: colors.textPrimary, fontSize: 14,
  },
  itemSearchClear: { padding: spacing.sm, marginLeft: spacing.xs },
  itemRarityRow: { flexDirection: "row", gap: spacing.xs },
  itemRarityChip: {
    paddingHorizontal: spacing.md, paddingVertical: 6,
    borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  itemRarityChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + "15" },
  itemRarityChipText: { ...typography.caption, fontWeight: "600", color: colors.textSecondary },
  itemRarityChipTextActive: { color: colors.primary, fontWeight: "800" },
});
