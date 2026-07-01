import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, RefreshControl, Modal, TextInput, Platform,
} from "react-native";
import { colors, typography, spacing, borderRadius, HAND, SERIF, BODY } from "../../theme";
import { Seal, SeaPaper } from "../../theme/whaleKit";
import { Avatar } from "../../components/Avatar";
import { ConfirmModal } from "../../components/ConfirmModal";
import { EditNicknameModal } from "../../components/EditNicknameModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "../../store/authStore";
import { getStats, updateProfile } from "../../services/user.api";
import { setPassword } from "../../services/auth.api";
import api, { fixImageUrl } from "../../services/api";
import * as ImagePicker from "expo-image-picker";

export function ProfileScreen({ navigation }: any) {
  const { user, setUser, logout } = useAuthStore();
  const [stats, setStats] = useState(user?.stats || { totalCollections: 0, hostedEvents: 0, participatedEvents: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [studentId, setStudentId] = useState((user as any)?.studentId || "");

  const fetchStats = useCallback(async () => {
    try {
      const res = await getStats();
      if (res.success && res.data) setStats(res.data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleChangeAvatar = async () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target?.files?.[0]; if (!file) return;
        const form = new FormData(); form.append("avatar", file);
        try {
          const token = await AsyncStorage.getItem("token");
          const res = await fetch("https://seekwhale.cn/api/v1/upload/avatar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
          const data = await res.json();
          if (data.success && user) { setUser({ ...user, avatar: data.data.url }); Alert.alert("✅", "头像已更新"); }
          else { Alert.alert("失败", data.error || "上传失败"); }
        } catch (e: any) { Alert.alert("失败", "网络错误"); }
      };
      input.click();
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("提示", "需要相册权限"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const form = new FormData();
      const uri = result.assets[0].uri;
      const ext = uri.split(".").pop() || "jpg";
      const file: any = { uri, name: `avatar.${ext}`, type: `image/${ext === "png" ? "png" : "jpeg"}` };
      form.append("avatar", file);
      const res = await api.post("/upload/avatar", form);
      if (res && (res as any).success && user) {
        setUser({ ...user, avatar: (res as any).data.url });
        Alert.alert("✅", "头像已更新");
      }
    } catch (e: any) { Alert.alert("失败", e?.error || "上传失败"); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  const handleSaveNickname = async (nickname: string) => {
    setSavingNickname(true);
    try {
      const res = await updateProfile({ nickname });
      if (res.success && res.data) {
        setUser(res.data);
        setNicknameModalVisible(false);
      }
    } catch (err: any) {
      Alert.alert("保存失败", err?.error || "请稍后再试");
    } finally {
      setSavingNickname(false);
    }
  };

  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  const handleDeleteAccount = () => {
    setDeleteModalVisible(true);
  };

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    logout();
  };

  const confirmDeleteAccount = async () => {
    setDeleteModalVisible(false);
    try {
      await import("../../services/user.api").then((m) => m.deleteAccount());
      Alert.alert("已注销", "你的账号及所有数据已被清空");
      logout();
    } catch (err: any) {
      Alert.alert("注销失败", err?.error || "请稍后再试");
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) { Alert.alert("提示", "密码至少6位"); return; }
    setSavingPassword(true);
    try {
      await setPassword(newPassword);
      setPasswordModalVisible(false);
      Alert.alert("✅", "密码设置成功！下次可使用密码登录");
    } catch (e: any) { Alert.alert("失败", e?.error || "设置失败"); }
    finally { setSavingPassword(false); }
  };

  const isAdmin = user?.role === "admin";

  return (
    <View style={styles.container}>
      <SeaPaper />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        {/* ── 船长证（含航行数据）── */}
        <View style={styles.licence}>
          <View style={styles.licenceSeal}><Seal size={62} /></View>
          <View style={styles.licenceHead}>
            <Text style={styles.licenceTitle}>寻鲸 · 船长证</Text>
            <Text style={styles.licenceEn}>CAPTAIN'S LICENCE</Text>
          </View>
          <View style={styles.licenceBody}>
            <Avatar
              uri={user?.avatar || undefined}
              size={64}
              emoji={user?.nickname ? user.nickname.charAt(0) : "?"}
              borderColor={isAdmin ? colors.rarity.典藏 : colors.primary}
            />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <Text style={styles.nickname}>{user?.nickname || "新船员"}</Text>
                <View style={styles.roleTag}><Text style={styles.roleTagText}>{isAdmin ? "管理员" : "船长"}</Text></View>
              </View>
              <Text style={styles.idText}>ID {user?.userId || "---"}</Text>
              <Text style={styles.email}>{user?.email || ""}</Text>
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
                <TouchableOpacity onPress={() => setNicknameModalVisible(true)} style={styles.editNicknameBtn}>
                  <Text style={styles.editNicknameText}>改名</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleChangeAvatar} style={styles.editNicknameBtn}>
                  <Text style={styles.editNicknameText}>换头像</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {/* 航行数据（并入船长证） */}
          <View style={styles.licenceStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalCollections}</Text>
              <Text style={styles.statLabel}>鲸藏</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.hostedEvents}</Text>
              <Text style={styles.statLabel}>发起同游</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.participatedEvents}</Text>
              <Text style={styles.statLabel}>参与同游</Text>
            </View>
          </View>
        </View>

        {/* ── 管理员入口 ── */}
        {isAdmin && (
          <TouchableOpacity style={styles.adminEntry} activeOpacity={0.7} onPress={() => navigation.navigate("AdminPanel")}>
            <Text style={styles.adminEntryText}>管理后台</Text>
            <Text style={styles.adminEntryArrow}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── 绑定学号 ── */}
        <View style={styles.studentIdRow}>
          <TextInput
            style={styles.studentIdInput}
            placeholder="绑定学号（用于学号登录）"
            placeholderTextColor={colors.textHint}
            value={studentId}
            onChangeText={setStudentId}
            autoCapitalize="none"
            maxLength={20}
          />
          <TouchableOpacity style={styles.saveStudentIdBtn} onPress={async () => {
            try {
              await updateProfile({ studentId: studentId.trim() });
              Alert.alert("✅", "学号已保存");
            } catch (e: any) { Alert.alert("失败", e?.error || ""); }
          }} activeOpacity={0.7}>
            <Text style={styles.saveStudentIdText}>保存</Text>
          </TouchableOpacity>
        </View>

        {/* ── 设置密码 ── */}
        <TouchableOpacity
          style={styles.setPasswordBtn}
          onPress={() => { setNewPassword(""); setPasswordModalVisible(true); }}
          activeOpacity={0.7}
        >
          <Text style={styles.setPasswordText}>设置登录密码</Text>
        </TouchableOpacity>

        {/* ── 底部操作 ── */}
        <View style={styles.actionsSection}>

          {/* 下载App（仅Web端显示） */}
          {Platform.OS === "web" && (
            <TouchableOpacity
              style={styles.feedbackButton}
              activeOpacity={0.7}
              onPress={() => {
                if (typeof document !== "undefined") {
                  const a = document.createElement("a");
                  a.href = "/app-release.apk";
                  a.download = "寻鲸.apk";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
            >
              <Text style={styles.feedbackButtonText}>下载 App（仅限安卓）</Text>
            </TouchableOpacity>
          )}

          {/* 问题反馈入口 */}
          <TouchableOpacity
            style={styles.feedbackButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("Feedback")}
          >
            <Text style={styles.feedbackButtonText}>问题反馈</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tutorialButton} onPress={() => { const { setJustLoggedIn } = useAuthStore.getState(); setJustLoggedIn(true); }} activeOpacity={0.7}>
            <Text style={{ ...typography.bodyBold, color: "#FFF" }}>查看教程</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.logoutText}>退出登录</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <Text style={styles.deleteText}>注销账号</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>寻鲸 v1.0</Text>
      </ScrollView>

      {/* ── Modals ── */}
      <EditNicknameModal
        visible={nicknameModalVisible}
        currentNickname={user?.nickname || ""}
        onSave={handleSaveNickname}
        onCancel={() => setNicknameModalVisible(false)}
        loading={savingNickname}
      />
      <ConfirmModal
        visible={logoutModalVisible}
        title="退出登录"
        message="确定要退出登录吗？"
        confirmText="退出"
        onConfirm={confirmLogout}
        onCancel={() => setLogoutModalVisible(false)}
      />
      <ConfirmModal
        visible={deleteModalVisible}
        title="注销账号"
        message="确定要注销账号吗？此操作不可恢复，所有藏品和数据将被清空！"
        confirmText="确认注销"
        confirmColor={colors.error}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setDeleteModalVisible(false)}
      />

      {/* 设置密码弹窗 */}
      <Modal visible={passwordModalVisible} transparent animationType="fade" onRequestClose={() => setPasswordModalVisible(false)}>
        <View style={pmStyles.overlay}>
          <View style={pmStyles.card}>
            <Text style={pmStyles.emoji}>🔐</Text>
            <Text style={pmStyles.title}>设置登录密码</Text>
            <Text style={pmStyles.sub}>设置后可使用邮箱+密码直接登录</Text>
            <TextInput
              style={pmStyles.input}
              placeholder="输入密码（至少6位）"
              placeholderTextColor={colors.textHint}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoFocus
            />
            <View style={pmStyles.btns}>
              <TouchableOpacity style={pmStyles.cancel} onPress={() => setPasswordModalVisible(false)}><Text style={pmStyles.cancelText}>取消</Text></TouchableOpacity>
              <TouchableOpacity style={pmStyles.save} onPress={handleSavePassword} disabled={savingPassword}><Text style={pmStyles.saveText}>{savingPassword ? "保存中..." : "保存"}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topDecoration: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    overflow: "hidden",
  },
  topCircle1: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.primaryLight + "30",
  },
  topCircle2: {
    position: "absolute",
    top: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.secondary + "30",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 52,
    paddingBottom: 120,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
  },
  // ── 船长证 ──
  licence: {
    width: "100%",
    backgroundColor: colors.paper2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary + "33",
    padding: 15,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  licenceSeal: { position: "absolute", right: 12, top: "50%", marginTop: -10, transform: [{ rotate: "-8deg" }] },
  licenceHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, paddingBottom: 9, borderBottomWidth: 1, borderStyle: "dashed", borderBottomColor: colors.primary + "33" },
  licenceTitle: { fontFamily: SERIF, fontStyle: "italic", fontSize: 13, color: colors.primary },
  licenceEn: { fontFamily: BODY, fontSize: 9.5, color: colors.faded, letterSpacing: 2 },
  licenceBody: { flexDirection: "row", alignItems: "center", gap: 13 },
  roleTag: { borderWidth: 1, borderColor: colors.primary + "66", borderRadius: 3, paddingHorizontal: 7, paddingVertical: 1 },
  roleTagText: { fontFamily: BODY, fontSize: 10, fontWeight: "700", color: colors.primary },
  licenceStats: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderStyle: "dashed", borderTopColor: colors.primary + "33" },
  avatarSection: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  nickname: {
    fontFamily: HAND,
    fontSize: 24,
    color: colors.textPrimary,
  },
  editNicknameBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  editNicknameText: {
    ...typography.caption,
    color: colors.primary,
  },
  idBadge: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  email: {
    ...typography.caption,
    color: colors.textHint,
    marginTop: spacing.xs,
  },
  adminBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.rarity.典藏 + "20",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  adminBadgeText: {
    ...typography.caption,
    color: colors.rarity.典藏,
    fontWeight: "700",
  },
  statsCard: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary + "26",
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  statsTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  statNumber: {
    fontFamily: HAND,
    color: colors.primary,
    fontSize: 28,
  },
  statLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.divider,
  },
  adminEntry: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  adminEntryEmoji: {
    fontSize: 22,
    marginRight: spacing.md,
  },
  adminEntryText: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    flex: 1,
  },
  adminEntryArrow: {
    ...typography.h2,
    color: colors.textHint,
  },
  studentIdRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  studentIdInput: { flex: 1, ...typography.body, backgroundColor: colors.surface, borderRadius: borderRadius.lg, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.textPrimary },
  saveStudentIdBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingHorizontal: spacing.xl, justifyContent: "center" },
  saveStudentIdText: { ...typography.bodyBold, color: "#FFF" },
  setPasswordBtn: { width: "100%", backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: "center", marginTop: spacing.lg, borderWidth: 1.5, borderColor: colors.secondary + "50" },
  setPasswordText: { ...typography.bodyBold, color: colors.textPrimary },
  actionsSection: {
    width: "100%",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  downloadButton: {
    backgroundColor: "#27AE60",
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  downloadButtonText: {
    ...typography.bodyBold,
    color: "#FFF",
    fontSize: 16,
  },
  downloadButtonHint: {
    ...typography.caption,
    color: "rgba(255,255,255,0.7)",
    marginTop: spacing.xs,
  },
  feedbackButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary + "50",
  },
  feedbackButtonText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  tutorialButton: { backgroundColor: colors.rarity.典藏, borderRadius: borderRadius.lg, padding: spacing.lg, alignItems: "center" },
  logoutButton: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  logoutText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  deleteButton: {
    width: "100%",
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  deleteText: {
    ...typography.body,
    color: colors.error,
  },
  version: {
    ...typography.small,
    color: colors.textHint,
    marginTop: spacing.xxxl,
    textAlign: "center",
  },
});

const pmStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xxl, width: "100%", maxWidth: 320, alignItems: "center" },
  emoji: { fontSize: 40, marginBottom: spacing.md },
  title: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  sub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.xl, textAlign: "center" },
  input: { width: "100%", ...typography.body, backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, marginBottom: spacing.xl },
  btns: { flexDirection: "row", gap: spacing.md, width: "100%" },
  cancel: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: borderRadius.xl, paddingVertical: spacing.md, alignItems: "center" },
  cancelText: { ...typography.button, color: colors.textSecondary },
  save: { flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.xl, paddingVertical: spacing.md, alignItems: "center" },
  saveText: { ...typography.button, color: colors.textOnPrimary },
});
