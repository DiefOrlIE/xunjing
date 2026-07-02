import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput,
  TouchableOpacity, Switch, Alert, ActivityIndicator,
} from "react-native";
import { colors, typography, spacing, borderRadius, HAND, KAI } from "../../theme";
import { createNote } from "../../services/note.api";

export function WriteNoteScreen({ route, navigation }: any) {
  const { userLocation, campus } = route.params || {};
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const text = content.trim();
    if (!text) { Alert.alert("提示", "请输入纸条内容"); return; }
    if (!userLocation) { Alert.alert("提示", "无法获取当前位置"); return; }

    setSubmitting(true);
    try {
      const res = await createNote({
        content: text,
        isAnonymous,
        lat: userLocation.lat,
        lng: userLocation.lng,
        campus: campus || "gulou",
      });
      if (res.success) {
        navigation.goBack();
      } else {
        Alert.alert("失败", (res as any).error || "请稍后重试");
      }
    } catch (e: any) {
      Alert.alert("失败", e?.message || "网络错误");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>写一张纸条</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* 内容区 */}
      <View style={styles.body}>
        <Text style={styles.hint}>
          把此刻的心情折进纸条，留在风里。路过的人啊，若你走近二十步，便能拾起这段心事。
        </Text>

        <TextInput
          style={styles.textArea}
          value={content}
          onChangeText={(t) => setContent(t.slice(0, 500))}
          placeholder="在此写下你的心声..."
          placeholderTextColor={colors.textHint}
          multiline
          textAlignVertical="top"
          maxLength={500}
          autoFocus
        />
        <Text style={styles.charCount}>{content.length}/500</Text>

        {/* 匿名开关 */}
        <View style={styles.anonRow}>
          <View style={styles.anonLabel}>
            <Text style={styles.anonText}>
              {isAnonymous ? "匿名留下" : "实名留下"}
            </Text>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={setIsAnonymous}
            trackColor={{ false: colors.border, true: colors.primary + "60" }}
            thumbColor={isAnonymous ? colors.primary : "#f4f3f4"}
          />
        </View>

        {/* 提交按钮 */}
        <TouchableOpacity
          style={[styles.submitBtn, (!content.trim() || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!content.trim() || submitting}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitText}>留下纸条</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 56, paddingBottom: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, flexDirection: "row", alignItems: "center",
    borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 4,
    justifyContent: "space-between",
  },
  backBtn: { paddingHorizontal: spacing.xs, width: 40 },
  backText: { ...typography.h2, color: colors.primary },
  headerTitle: { fontFamily: HAND, fontSize: 22, color: colors.ink },
  body: { flex: 1, padding: spacing.lg },
  hint: {
    ...typography.caption, color: colors.textHint, marginBottom: spacing.lg,
    backgroundColor: colors.primary + "08", padding: spacing.md, borderRadius: borderRadius.md,
    lineHeight: 20,
  },
  textArea: {
    flex: 1, ...typography.body, fontFamily: KAI, color: colors.textPrimary,
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, fontSize: 16, lineHeight: 26,
    borderWidth: 1, borderColor: colors.border,
    maxHeight: 300,
  },
  charCount: {
    ...typography.caption, color: colors.textHint,
    textAlign: "right", marginTop: spacing.xs, marginBottom: spacing.lg,
  },
  anonRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface, borderRadius: borderRadius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  anonLabel: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  anonEmoji: { fontSize: 24 },
  anonText: { ...typography.body, color: colors.textPrimary },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg,
    paddingVertical: spacing.md + 4, alignItems: "center",
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { ...typography.bodyBold, color: "#FFF", fontSize: 18 },
});
