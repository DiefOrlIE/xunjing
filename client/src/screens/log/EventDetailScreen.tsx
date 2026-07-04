import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, TextInput, Modal, Image, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { Avatar } from "../../components/Avatar";
import { ConfirmModal } from "../../components/ConfirmModal";
import { ACTIVITY_STATUS_LABELS, PARTICIPANT_STATUS_LABELS } from "../../utils/constants";
import { getEventDetail, stopRecruiting, cancelEvent, exitEvent, applyToEvent } from "../../services/event.api";
import { sendFriendRequest } from "../../services/friend.api";
import { submitReport } from "../../services/report.api";
import { getReviews, submitReview, EventReviewItem } from "../../services/eventReview.api";
import { getMemories, submitMemory, uploadMemoryImage, EventMemoryItem } from "../../services/eventMemory.api";
import api, { fixImageUrl } from "../../services/api";
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
  const [reportTarget, setReportTarget] = useState<{ type: "user" | "event"; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  // 活动评价
  const [reviews, setReviews] = useState<EventReviewItem[]>([]);
  const [reviewAvg, setReviewAvg] = useState(0);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  // 共同记忆墙
  const [memories, setMemories] = useState<EventMemoryItem[]>([]);
  const [memText, setMemText] = useState("");
  const [memImageUrl, setMemImageUrl] = useState("");
  const [memUploading, setMemUploading] = useState(false);
  const [memSubmitting, setMemSubmitting] = useState(false);

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

  const fetchReviews = useCallback(async () => {
    try {
      const res = await getReviews(eventId);
      if (res.success && res.data) {
        setReviews(res.data.reviews || []);
        setReviewAvg(res.data.average || 0);
        if (res.data.myReview) {
          setMyRating(res.data.myReview.rating);
          setMyComment(res.data.myReview.comment || "");
        }
      }
    } catch {}
  }, [eventId]);

  const canMemory = myRole === "host" || myStatus === "accepted";
  const memoryVisible = canMemory && (event?.status === "ongoing" || event?.status === "finished");

  const fetchMemories = useCallback(async () => {
    try {
      const res = await getMemories(eventId);
      if (res.success && res.data) setMemories(res.data.memories || []);
    } catch {}
  }, [eventId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => { if (event?.status === "finished") fetchReviews(); }, [event?.status, fetchReviews]);
  useEffect(() => { if (memoryVisible) fetchMemories(); }, [memoryVisible, fetchMemories]);

  const onRefresh = () => {
    setRefreshing(true); fetchDetail();
    if (event?.status === "finished") fetchReviews();
    if (memoryVisible) fetchMemories();
  };

  const handlePickMemoryImage = async () => {
    setMemUploading(true);
    try {
      if (Platform.OS === "web") {
        const url = await new Promise<string>((resolve, reject) => {
          const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
          input.onchange = async (e: any) => {
            const file = e.target?.files?.[0]; if (!file) { reject(new Error("cancel")); return; }
            const form = new FormData(); form.append("image", file);
            try { const res = await uploadMemoryImage(form as any); resolve((res as any)?.data?.url || ""); }
            catch (err) { reject(err); }
          };
          input.click();
        });
        if (url) setMemImageUrl(url);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("提示", "需要相册权限"); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
        if (result.canceled || !result.assets?.[0]) return;
        const uri = result.assets[0].uri;
        const ext = uri.split(".").pop() || "jpg";
        const form = new FormData();
        form.append("image", { uri, name: `memory.${ext}`, type: `image/${ext === "png" ? "png" : "jpeg"}` } as any);
        const res = await uploadMemoryImage(form as any);
        if ((res as any)?.success) setMemImageUrl((res as any).data.url);
      }
    } catch (e: any) { if (e?.message !== "cancel") Alert.alert("失败", "图片上传失败"); }
    finally { setMemUploading(false); }
  };

  const handleSubmitMemory = async () => {
    if (!memText.trim() && !memImageUrl) { Alert.alert("提示", "写点文字或加张图片吧"); return; }
    setMemSubmitting(true);
    try {
      await submitMemory(eventId, memText.trim(), memImageUrl);
      setMemText(""); setMemImageUrl("");
      fetchMemories();
    } catch (e: any) { Alert.alert("失败", e?.error || "发布失败"); }
    finally { setMemSubmitting(false); }
  };

  const handleSubmitReview = async () => {
    if (!myRating) { Alert.alert("提示", "请先选择评分"); return; }
    setReviewSubmitting(true);
    try {
      await submitReview(eventId, myRating, myComment.trim());
      Alert.alert("✅", "评价已提交");
      fetchReviews();
    } catch (e: any) { Alert.alert("失败", e?.error || "提交失败"); }
    finally { setReviewSubmitting(false); }
  };

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

  const handleSubmitReport = async () => {
    if (!reportTarget || !reportReason.trim()) { Alert.alert("提示", "请填写举报原因"); return; }
    setReportSubmitting(true);
    try {
      await submitReport(reportTarget.type, reportTarget.id, reportReason.trim());
      Alert.alert("✅", "举报已提交，我们会尽快处理");
      setReportTarget(null); setReportReason("");
    } catch (e: any) { Alert.alert("失败", e?.error || "提交失败"); }
    finally { setReportSubmitting(false); }
  };

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
        <TouchableOpacity onPress={() => setReportTarget({ type: "event", id: eventId, label: "该活动" })}>
          <Text style={styles.backText}>🚩 举报</Text>
        </TouchableOpacity>
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
                  {numericId !== user?.userId && pu?._id && (
                    <TouchableOpacity style={styles.participantAction} onPress={() => setReportTarget({ type: "user", id: pu._id, label: pu?.nickname || "该用户" })}>
                      <Text style={styles.participantActionText}>🚩</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* 活动评价（仅活动结束后） */}
        {event.status === "finished" && (
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
              <Text style={styles.sectionTitle}>⭐ 活动评价 ({reviews.length})</Text>
              {reviews.length > 0 && <Text style={styles.reviewAvgText}>平均 {reviewAvg.toFixed(1)} 分</Text>}
            </View>

            {/* 我的评价（仅参与者可评） */}
            {isParticipant && (
              <View style={styles.myReviewBox}>
                <Text style={styles.myReviewLabel}>{myRating ? "修改我的评价" : "为这次活动打个分吧"}</Text>
                <StarRow value={myRating} onChange={setMyRating} />
                <TextInput
                  style={styles.reviewCommentInput}
                  placeholder="说说这次活动怎么样...（选填）"
                  placeholderTextColor={colors.textHint}
                  value={myComment}
                  onChangeText={setMyComment}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.reviewSubmitBtn, reviewSubmitting && { opacity: 0.6 }]}
                  onPress={handleSubmitReview}
                  disabled={reviewSubmitting}
                >
                  <Text style={styles.reviewSubmitText}>{reviewSubmitting ? "提交中..." : "提交评价"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 全部评价 */}
            {reviews.length === 0 ? (
              <Text style={styles.reviewEmpty}>还没有人评价，来做第一个吧～</Text>
            ) : (
              reviews.map((rv, i) => {
                const ru = rv.userId && typeof rv.userId === "object" ? rv.userId : ({} as any);
                return (
                  <View key={rv._id || i} style={styles.reviewRow}>
                    <Avatar uri={ru?.avatar || undefined} size={32} emoji={ru?.nickname?.charAt(0) || "?"} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <Text style={styles.reviewName}>{ru?.nickname || "用户"}</Text>
                        <Text style={styles.reviewStars}>{"★".repeat(rv.rating)}{"☆".repeat(5 - rv.rating)}</Text>
                      </View>
                      {rv.comment ? <Text style={styles.reviewComment}>{rv.comment}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* 共同记忆墙（参与者，活动进行中/已结束） */}
        {memoryVisible && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>📷 共同记忆 ({memories.length})</Text>

            {/* 发布区 */}
            <View style={styles.memInputBox}>
              <TextInput
                style={styles.memTextInput}
                placeholder="分享这次活动的瞬间...（图文任填其一）"
                placeholderTextColor={colors.textHint}
                value={memText}
                onChangeText={setMemText}
                multiline
                maxLength={1000}
              />
              {memImageUrl ? (
                <View style={styles.memPreviewWrap}>
                  <Image source={{ uri: fixImageUrl(memImageUrl) }} style={styles.memPreviewImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.memPreviewRemove} onPress={() => setMemImageUrl("")}>
                    <Text style={{ color: "#FFF", fontWeight: "700" }}>×</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <View style={styles.memActions}>
                <TouchableOpacity style={styles.memImgBtn} onPress={handlePickMemoryImage} disabled={memUploading}>
                  <Text style={styles.memImgBtnText}>{memUploading ? "上传中..." : "🖼️ 加图片"}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.memSendBtn, memSubmitting && { opacity: 0.6 }]}
                  onPress={handleSubmitMemory}
                  disabled={memSubmitting}
                >
                  <Text style={styles.memSendText}>{memSubmitting ? "发布中..." : "发布"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 记忆列表 */}
            {memories.length === 0 ? (
              <Text style={styles.reviewEmpty}>还没有记忆，留下第一张照片吧～</Text>
            ) : (
              memories.map((m, i) => {
                const mu = m.userId && typeof m.userId === "object" ? m.userId : ({} as any);
                return (
                  <View key={m._id || i} style={styles.memRow}>
                    <Avatar uri={mu?.avatar || undefined} size={32} emoji={mu?.nickname?.charAt(0) || "?"} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reviewName}>{mu?.nickname || "用户"}</Text>
                      {m.content ? <Text style={styles.memContent}>{m.content}</Text> : null}
                      {m.imageUrl ? (
                        <Image source={{ uri: fixImageUrl(m.imageUrl) }} style={styles.memImage} resizeMode="cover" />
                      ) : null}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

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

      {/* 举报弹窗 */}
      <Modal visible={!!reportTarget} transparent animationType="fade" onRequestClose={() => setReportTarget(null)}>
        <View style={styles.reportOverlay}>
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>🚩 举报{reportTarget?.label}</Text>
            <TextInput
              style={styles.reportInput}
              placeholder="请填写举报原因..."
              placeholderTextColor={colors.textHint}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
            />
            <View style={styles.reportBtns}>
              <TouchableOpacity style={styles.reportCancelBtn} onPress={() => { setReportTarget(null); setReportReason(""); }}>
                <Text style={styles.reportCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.reportSubmitBtn, reportSubmitting && { opacity: 0.6 }]} onPress={handleSubmitReport} disabled={reportSubmitting}>
                <Text style={styles.reportSubmitText}>{reportSubmitting ? "提交中..." : "提交举报"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

function StarRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: "row", marginVertical: spacing.sm }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
          <Text style={{ fontSize: 30, marginRight: 4, color: n <= value ? "#F5B301" : colors.border }}>
            {n <= value ? "★" : "☆"}
          </Text>
        </TouchableOpacity>
      ))}
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
  reportOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: spacing.xl },
  reportCard: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl },
  reportTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.lg },
  reportInput: {
    backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: colors.border, padding: spacing.md, ...typography.body, color: colors.textPrimary,
    minHeight: 80, marginBottom: spacing.lg,
  },
  reportBtns: { flexDirection: "row", gap: spacing.md },
  reportCancelBtn: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: "center" },
  reportCancelText: { ...typography.button, color: colors.textSecondary },
  reportSubmitBtn: { flex: 1, backgroundColor: colors.error, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: "center" },
  reportSubmitText: { ...typography.button, color: "#FFF" },
  // 活动评价
  reviewAvgText: { ...typography.caption, color: "#F5B301", fontWeight: "700" },
  myReviewBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  myReviewLabel: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  reviewCommentInput: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, ...typography.body, color: colors.textPrimary, minHeight: 56, marginBottom: spacing.sm,
  },
  reviewSubmitBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, alignItems: "center" },
  reviewSubmitText: { ...typography.button, color: "#FFF" },
  reviewEmpty: { ...typography.caption, color: colors.textHint, textAlign: "center", paddingVertical: spacing.md },
  reviewRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  reviewName: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
  reviewStars: { fontSize: 13, color: "#F5B301" },
  reviewComment: { ...typography.body, color: colors.textSecondary, marginTop: 2, fontSize: 14 },
  // 共同记忆墙
  memInputBox: { backgroundColor: colors.background, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md },
  memTextInput: {
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, ...typography.body, color: colors.textPrimary, minHeight: 56, marginBottom: spacing.sm,
  },
  memPreviewWrap: { position: "relative", marginBottom: spacing.sm, alignSelf: "flex-start" },
  memPreviewImg: { width: 100, height: 100, borderRadius: borderRadius.md },
  memPreviewRemove: {
    position: "absolute", top: -8, right: -8, width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.error, alignItems: "center", justifyContent: "center",
  },
  memActions: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  memImgBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  memImgBtnText: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  memSendBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, alignItems: "center" },
  memSendText: { ...typography.button, color: "#FFF" },
  memRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  memContent: { ...typography.body, color: colors.textPrimary, marginTop: 2, fontSize: 14 },
  memImage: { width: "100%", height: 180, borderRadius: borderRadius.md, marginTop: spacing.sm, backgroundColor: colors.background },
});
