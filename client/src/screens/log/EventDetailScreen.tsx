import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { Avatar } from "../../components/Avatar";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ACTIVITY_STATUS_LABELS, PARTICIPANT_STATUS_LABELS } from "../../utils/constants";
import { getEventDetail, stopRecruiting, cancelEvent, exitEvent, applyToEvent } from "../../services/event.api";
import { sendFriendRequest } from "../../services/friend.api";
import api from "../../services/api";
import { useAuthStore } from "../../store/authStore";

export function EventDetailScreen({ route, navigation }: any) {
  const { eventId } = route.params;
  const { user } = useAuthStore();
  const [event, setEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [hostStats, setHostStats] = useState<{ finished: number; cancelled: number; successRate: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const isHost = myRole === "host";
  const statusLabel = event ? ACTIVITY_STATUS_LABELS[event.status] || event.status : "";
  const statusColor =
    event?.status === "recruiting" ? colors.info :
    event?.status === "finished" ? colors.success :
    event?.status === "cancelled" ? colors.error : colors.warning;

  const fetchDetail = useCallback(async () => {
    try {
      const res = await getEventDetail(eventId);
      if (res.success && res.data) {
        setEvent(res.data.event);
        const all = res.data.participants || [];
        setParticipants(all.filter((p: any) => p.status === "accepted"));
        setApplicants(all.filter((p: any) => p.status === "applied"));
        setMyRole(res.data.myRole);
        setMyStatus(res.data.myStatus);
        setHostStats(res.data.hostStats || null);
      }
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [eventId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const onRefresh = () => { setRefreshing(true); fetchDetail(); };

  const handleStop = async () => {
    setActionLoading(true);
    try { await stopRecruiting(eventId); setShowStopModal(false); fetchDetail(); Alert.alert("✅", "已停止招募"); }
    catch (e: any) { Alert.alert("失败", e?.error || "操作失败"); }
    finally { setActionLoading(false); }
  };

  const handleCancel = async () => {
    setActionLoading(true);
    try { await cancelEvent(eventId); setShowCancelModal(false); fetchDetail(); Alert.alert("已取消", "活动已取消"); }
    catch (e: any) { Alert.alert("失败", e?.error || "操作失败"); }
    finally { setActionLoading(false); }
  };

  const handleExit = async () => {
    setActionLoading(true);
    try { await exitEvent(eventId); setShowExitModal(false); fetchDetail(); Alert.alert(myStatus === "applied" ? "已取消" : "已退出", myStatus === "applied" ? "已取消申请" : "你已退出该活动"); }
    catch (e: any) { Alert.alert("失败", e?.error || "操作失败"); }
    finally { setActionLoading(false); }
  };

  const handleApply = async () => {
    setActionLoading(true);
    try { await applyToEvent(eventId); fetchDetail(); Alert.alert("已申请", "申请已发送，等待发布者审核。可在活动广场顶部「我参与的」查看进度。"); }
    catch (e: any) { Alert.alert("申请失败", e?.error || "操作失败"); }
    finally { setActionLoading(false); }
  };

  const handleAccept = async (applicantId: string) => {
    try { await api.post(`/events/${eventId}/applications/${applicantId}/accept`); fetchDetail(); }
    catch (e: any) { Alert.alert("失败", e?.error || "操作失败"); }
  };
  const handleReject = async (applicantId: string) => {
    try { await api.post(`/events/${eventId}/applications/${applicantId}/reject`); fetchDetail(); }
    catch (e: any) { Alert.alert("失败", e?.error || "操作失败"); }
  };

  const isParticipant = myRole === "host" || myStatus === "accepted" || myStatus === "applied";

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  if (!event) {
    return <View style={styles.loadingContainer}><Text style={styles.emptyText}>活动不存在</Text></View>;
  }

  return (
    <View style={styles.container}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backText}>← 返回</Text></TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>活动详情</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* 状态 */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "15", borderColor: statusColor + "40" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* 基础信息 */}
        <View style={styles.infoCard}>
          {event.typeId?.name ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <Text style={{ fontSize: 14 }}>{event.typeId.iconUrl || "📋"}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: event.typeId.color || "#3498DB" }}>{event.typeId.name}</Text>
            </View>
          ) : null}
          <Text style={styles.infoTitle}>{event.title || "默认主题"}</Text>
          <InfoRow label="⏰ 时间" value={`${new Date(event.startTime).toLocaleString("zh-CN")} → ${new Date(event.endTime).toLocaleString("zh-CN")}`} />
          <InfoRow label="👥 人数" value={`${event.currentParticipants || 1} / ${event.capacity}`} />
          <InfoRow label="📍 校区" value={event.campus === "gulou" ? "鼓楼校区" : event.campus === "xianlin" ? "仙林校区" : event.campus === "suzhou" ? "苏州校区" : event.campus} />
          <InfoRow label="📌 地点" value={event.locationText} />
          {hostStats?.successRate != null && <InfoRow label="🏆 发起人成功率" value={`${hostStats.successRate}% (${hostStats.finished}/${hostStats.finished + hostStats.cancelled})`} />}
          {event.description ? <InfoRow label="📝 说明" value={event.description} /> : null}
        </View>

        {/* 参与者列表 */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>👥 参与成员 ({participants.length})</Text>
          {participants.map((p: any, i: number) => {
            const pu = p?.userId && typeof p.userId === "object" ? p.userId : {};
            const numericId = pu?.userId;
            return (
              <View key={i} style={styles.participantRow}>
                <Avatar uri={pu?.avatar || undefined} size={36} emoji={pu?.nickname?.charAt(0) || "?"} />
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>{(pu?.nickname || "用户") + (p?.role === "host" ? " (发布者)" : "")}</Text>
                  <Text style={styles.participantId}>ID: {numericId || "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: spacing.xs }}>
                  <TouchableOpacity style={styles.participantAction} onPress={() => navigation.navigate("UserGallery", { userId: numericId, nickname: pu?.nickname })}>
                    <Text style={styles.participantActionText}>🏛️</Text>
                  </TouchableOpacity>
                  {numericId !== user?.userId && (
                    <TouchableOpacity style={styles.participantAction} onPress={async () => {
                      try { await sendFriendRequest(numericId); Alert.alert("已发送", "好友申请已发送"); }
                      catch (e: any) { Alert.alert("失败", e?.error || "发送失败"); }
                    }}>
                      <Text style={styles.participantActionText}>➕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* 待审核申请 */}
        {isHost && event.status === "recruiting" && applicants.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>⏳ 待审核 ({applicants.length})</Text>
            {applicants.map((a: any, i: number) => {
              const au = a.userId || {};
              return (
                <View key={i} style={styles.applicantRow}>
                  <Avatar uri={au.avatar} size={36} emoji={au.nickname?.charAt(0) || "?"} />
                  <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{au.nickname || "用户"}</Text>
                    <Text style={styles.participantId}>ID: {au.userId || "—"}</Text>
                  </View>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(a.userId?._id || a.userId)}>
                    <Text style={styles.acceptBtnText}>同意</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(a.userId?._id || a.userId)}>
                    <Text style={styles.rejectBtnText}>拒绝</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* 操作按钮 */}
        {isHost && event.status === "recruiting" && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.stopBtn]} onPress={() => setShowStopModal(true)}>
              <Text style={styles.actionBtnText}>🛑 停止招募</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={() => setShowCancelModal(true)}>
              <Text style={[styles.actionBtnText, { color: colors.error }]}>❌ 取消活动</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isHost && myStatus === "accepted" && event.status !== "finished" && event.status !== "cancelled" && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.exitBtn]} onPress={() => setShowExitModal(true)}>
              <Text style={[styles.actionBtnText, { color: colors.error }]}>🚪 退出活动</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 已申请（待审核）可取消申请 */}
        {!isHost && myStatus === "applied" && event.status === "recruiting" && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.exitBtn]} onPress={() => setShowExitModal(true)}>
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>↩ 取消申请</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 非参与者可以申请加入 */}
        {!isHost && !isParticipant && event.status === "recruiting" && (
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.applyBtn]} onPress={handleApply}>
              <Text style={[styles.actionBtnText, { color: colors.primary }]}>✋ 申请加入</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 群聊入口 */}
        {(myStatus === "accepted" || isHost) && event.status !== "cancelled" && (
          <TouchableOpacity
            style={styles.chatEntry}
            onPress={() => navigation.navigate("GroupChat", { eventId })}
          >
            <Text style={styles.chatEntryText}>💬 进入临时会话</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Modals */}
      <ConfirmModal visible={showStopModal} title="停止招募" message="确认停止招募吗？停止后其他人将无法申请加入。" confirmText="确认停止" onConfirm={handleStop} onCancel={() => setShowStopModal(false)} />
      <ConfirmModal visible={showCancelModal} title="取消活动" message="确认取消活动吗？此操作不可撤销，所有参与者将收到通知。" confirmText="确认取消" confirmColor={colors.error} onConfirm={handleCancel} onCancel={() => setShowCancelModal(false)} />
      <ConfirmModal
        visible={showExitModal}
        title={myStatus === "applied" ? "取消申请" : "退出活动"}
        message={myStatus === "applied" ? "确认取消申请吗？取消后该活动将从「我参与的」中移除。" : "确认退出活动吗？退出后将不再接收活动通知。"}
        confirmText={myStatus === "applied" ? "确认取消" : "确认退出"}
        confirmColor={myStatus === "applied" ? colors.warning : colors.error}
        onConfirm={handleExit}
        onCancel={() => setShowExitModal(false)}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={irStyles.row}>
      <Text style={irStyles.label}>{label}</Text>
      <Text style={irStyles.value}>{value}</Text>
    </View>
  );
}

const irStyles = StyleSheet.create({
  row: { flexDirection: "row", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { ...typography.caption, color: colors.textSecondary, width: 70, fontWeight: "600" },
  value: { ...typography.body, color: colors.textPrimary, flex: 1, fontSize: 15 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  emptyText: { ...typography.body, color: colors.textHint },
  header: {
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderBottomLeftRadius: borderRadius.xl, borderBottomRightRadius: borderRadius.xl,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 6, zIndex: 10,
  },
  backText: { ...typography.body, color: colors.primary, fontWeight: "600" },
  headerTitle: { fontFamily: HAND, fontSize: 20, color: colors.ink, flex: 1, textAlign: "center" },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg },
  statusBadge: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1.5 },
  statusText: { ...typography.bodyBold, fontSize: 15 },
  roleText: { ...typography.body, color: colors.textSecondary },
  infoCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md },
  infoTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.md },
  sectionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.md },
  participantRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md },
  participantInfo: { flex: 1 },
  participantName: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  participantId: { ...typography.caption, color: colors.textHint },
  applicantRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, gap: spacing.md },
  acceptBtn: { backgroundColor: colors.success, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full },
  acceptBtnText: { ...typography.caption, fontWeight: "700", color: "#FFF" },
  rejectBtn: { backgroundColor: colors.error + "20", paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.full, marginLeft: spacing.xs },
  rejectBtnText: { ...typography.caption, fontWeight: "600", color: colors.error },
  participantAction: { padding: spacing.sm },
  participantActionText: { fontSize: 20 },
  actions: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  actionBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.lg, alignItems: "center", backgroundColor: colors.surface },
  stopBtn: { borderWidth: 1.5, borderColor: colors.warning + "50" },
  cancelBtn: { borderWidth: 1.5, borderColor: colors.error + "30" },
  exitBtn: { borderWidth: 1.5, borderColor: colors.error + "30" },
  applyBtn: { borderWidth: 2, borderColor: colors.primary + "50", backgroundColor: colors.primary + "08" },
  actionBtnText: { ...typography.bodyBold, color: colors.textPrimary },
  chatEntry: {
    backgroundColor: colors.primary, borderRadius: borderRadius.xl, paddingVertical: spacing.lg,
    alignItems: "center", shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  chatEntryText: { ...typography.button, color: "#FFF", fontSize: 17 },
});
