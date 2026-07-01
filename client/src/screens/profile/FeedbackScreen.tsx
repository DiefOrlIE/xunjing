import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { EmptyState } from "../../components/EmptyState";
import { submitFeedback, getMyFeedback, FeedbackItem } from "../../services/feedback.api";

export function FeedbackScreen({ navigation }: any) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [myFeedbacks, setMyFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"submit" | "history">("submit");

  const fetchMyFeedbacks = useCallback(async () => {
    try {
      const res = await getMyFeedback(1, 50);
      if (res.success && res.data) {
        setMyFeedbacks(res.data.items);
      }
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMyFeedbacks();
  }, [fetchMyFeedbacks]);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert("提示", "请输入反馈内容");
      return;
    }
    if (trimmed.length < 4) {
      Alert.alert("提示", "反馈内容至少4个字");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitFeedback(trimmed);
      if (res.success) {
        Alert.alert("✅", res.message || "反馈已提交，感谢你的反馈！");
        setContent("");
        fetchMyFeedbacks();
        setTab("history");
      } else {
        Alert.alert("提交失败", (res as any).error || "请稍后再试");
      }
    } catch (e: any) {
      Alert.alert("提交失败", e?.error || "网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  const statusLabel = (status: string) =>
    status === "pending" ? "⏳ 处理中" : "✅ 已处理";

  const statusColor = (status: string) =>
    status === "pending" ? colors.warning : colors.success;

  const renderFeedbackItem = ({ item }: { item: FeedbackItem }) => (
    <View style={styles.feedbackCard}>
      <View style={styles.feedbackHeader}>
        <Text style={styles.feedbackDate}>
          {new Date(item.createdAt).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + "20" }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
      </View>
      <Text style={styles.feedbackContent}>{item.content}</Text>
      {item.adminReply ? (
        <View style={styles.replyBox}>
          <Text style={styles.replyLabel}>👑 管理员回复：</Text>
          <Text style={styles.replyContent}>{item.adminReply}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>问题反馈</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Tab切换 */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "submit" && styles.tabActive]}
          onPress={() => setTab("submit")}
        >
          <Text style={[styles.tabText, tab === "submit" && styles.tabTextActive]}>
            ✍️ 提交反馈
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "history" && styles.tabActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>
            📋 我的反馈 {myFeedbacks.length > 0 ? `(${myFeedbacks.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "submit" ? (
        <View style={styles.submitSection}>
          <Text style={styles.label}>反馈内容</Text>
          <TextInput
            style={styles.textarea}
            placeholder="请详细描述你遇到的问题或建议..."
            placeholderTextColor={colors.textHint}
            value={content}
            onChangeText={setContent}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={2000}
          />
          <Text style={styles.charCount}>{content.length}/2000</Text>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.7}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? "提交中..." : "📤 提交反馈"}
            </Text>
          </TouchableOpacity>

          <View style={styles.tipsBox}>
            <Text style={styles.tipsTitle}>💡 温馨提示：</Text>
            <Text style={styles.tipsText}>• 请尽量详细描述问题，方便我们快速定位</Text>
            <Text style={styles.tipsText}>• 如有截图请保留，后续可能通过消息联系</Text>
            <Text style={styles.tipsText}>• 管理员处理后你将在"我的反馈"中看到回复</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={myFeedbacks}
          keyExtractor={(item) => item._id}
          renderItem={renderFeedbackItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <EmptyState emoji="📭" title="暂无反馈" subtitle="点击上方提交反馈" />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchMyFeedbacks(); }}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 56,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: borderRadius.xl,
    borderBottomRightRadius: borderRadius.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 10,
  },
  backBtn: { paddingRight: spacing.md },
  backText: { ...typography.h2, color: colors.primary },
  headerTitle: { fontFamily: HAND, fontSize: 24, color: colors.ink },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: "center" },
  tabActive: { backgroundColor: colors.primary + "15" },
  tabText: { ...typography.bodyBold, color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  submitSection: { flex: 1, padding: spacing.lg },
  label: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  textarea: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    ...typography.body,
    color: colors.textPrimary,
    minHeight: 160,
  },
  charCount: {
    ...typography.small,
    color: colors.textHint,
    textAlign: "right",
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { ...typography.button, color: "#FFF", fontSize: 17 },
  tipsBox: {
    marginTop: spacing.xxl,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipsTitle: { ...typography.bodyBold, color: colors.textSecondary, marginBottom: spacing.sm },
  tipsText: { ...typography.small, color: colors.textHint, marginBottom: spacing.xs, lineHeight: 20 },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  feedbackCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  feedbackDate: { ...typography.small, color: colors.textHint },
  statusBadge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  statusText: { ...typography.small, fontWeight: "700", fontSize: 11 },
  feedbackContent: { ...typography.body, color: colors.textPrimary, lineHeight: 22 },
  replyBox: {
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight + "15",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  replyLabel: { ...typography.caption, fontWeight: "700", color: colors.primary, marginBottom: spacing.xs },
  replyContent: { ...typography.body, color: colors.textPrimary, lineHeight: 21 },
});
