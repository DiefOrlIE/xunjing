import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator,
} from "react-native";
import { colors, typography, spacing, borderRadius, HAND, BODY } from "../../theme";
import { Campus, CAMPUS_NAMES } from "../../utils/constants";
import { getEventTypes, createEvent } from "../../services/event.api";
import { EventTypeData } from "../../types";

export function PublishEventScreen({ navigation }: any) {
  const [eventTypes, setEventTypes] = useState<EventTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const [selectedType, setSelectedType] = useState<string>("");
  const [title, setTitle] = useState("");
  const today = new Date();
  const [sY, setSY] = useState(String(today.getFullYear()));
  const [sMo, setSMo] = useState(String(today.getMonth() + 1));
  const [sD, setSD] = useState(String(today.getDate()));
  const [sH, setSH] = useState("09");
  const [sMi, setSMi] = useState("00");
  const [eY, setEY] = useState(String(today.getFullYear()));
  const [eMo, setEMo] = useState(String(today.getMonth() + 1));
  const [eD, setED] = useState(String(today.getDate()));
  const [eH, setEH] = useState("11");
  const [eMi, setEMi] = useState("00");
  const buildISO = (y: string, mo: string, d: string, h: string, mi: string) =>
    `${y.padStart(4,"0")}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}T${h.padStart(2,"0")}:${mi.padStart(2,"0")}:00`;
  const [capacity, setCapacity] = useState(2);
  const [campus, setCampus] = useState<Campus>(Campus.GULOU);
  const [locationText, setLocationText] = useState("");
  const [meetCoord, setMeetCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    (async () => {
      try { const res = await getEventTypes(); if (res.success && res.data) setEventTypes(res.data); } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleReset = () => {
    setSelectedType(""); setTitle(""); const t = new Date();
    setSY(String(t.getFullYear())); setSMo(String(t.getMonth()+1)); setSD(String(t.getDate())); setSH("09"); setSMi("00");
    setEY(String(t.getFullYear())); setEMo(String(t.getMonth()+1)); setED(String(t.getDate())); setEH("11"); setEMi("00");
    setCapacity(2); setCampus(Campus.GULOU); setLocationText(""); setMeetCoord(null); setDescription("");
  };

  const validate = (): string | null => {
    if (!title.trim()) return "请填写活动主题";
    if (!selectedType) return "请选择活动类型";
    const start = new Date(buildISO(sY,sMo,sD,sH,sMi));
    const end = new Date(buildISO(eY,eMo,eD,eH,eMi));
    if (isNaN(start.getTime())) return "开始时间不完整";
    if (isNaN(end.getTime())) return "结束时间不完整";
    if (start <= new Date()) return "不能发布过去的活动，请选择未来的时间";
    if (end <= start) return "结束时间必须晚于开始时间";
    if (capacity < 2) return "容纳人数至少为2人";
    if (!locationText.trim()) return "请填写具体地点";
    if (!meetCoord) return "请在地图上选择碰头地点";
    return null;
  };

  const handleSubmit = () => {
    const err = validate();
    if (err) { Alert.alert("提示", err); return; }
    Alert.alert("确认发布", "确认发布招募吗？", [
      { text: "取消", style: "cancel" },
      { text: "确认", onPress: async () => {
        setSubmitting(true);
        try {
          const res = await createEvent({
            title: title.trim(),
            typeId: selectedType,
            startTime: new Date(buildISO(sY,sMo,sD,sH,sMi)).toISOString(),
            endTime: new Date(buildISO(eY,eMo,eD,eH,eMi)).toISOString(),
            capacity, campus,
            locationText: locationText.trim(),
            meetCoordinates: meetCoord,
            description: description.trim(),
          });
          if (res.success) { Alert.alert("发布成功", "你的同游已发布！可在活动广场顶部「我参与的」查看和管理。"); handleReset(); }
        } catch (err: any) { Alert.alert("发布失败", err?.error || "请稍后再试"); }
        finally { setSubmitting(false); }
      }},
    ]);
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>发起同游</Text>
          <Text style={styles.headerEn}>VOYAGE LOG · 出航申请单</Text>
        </View>
        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
          <Text style={styles.resetText}>清空</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Step 1: 基本信息 */}
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
          <Text style={styles.stepTitle}>基本信息</Text>
        </View>

        {/* 活动主题 */}
        <Text style={styles.label}>活动主题 <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="例如：周末羽毛球搭子、图书馆自习" placeholderTextColor={colors.textHint} value={title} onChangeText={setTitle} maxLength={100} />

        {/* 活动类型 */}
        <Text style={[styles.label, { marginTop: spacing.md }]}>活动类型 <Text style={styles.required}>*</Text></Text>
        <View style={styles.typeGrid}>
          {eventTypes.length === 0 && <Text style={styles.noTypes}>暂无活动类型（需管理员在后台添加）</Text>}
          {eventTypes.map((t) => (
            <TouchableOpacity
              key={t._id}
              style={[styles.typeCard, selectedType === t._id && styles.typeCardActive]}
              onPress={() => setSelectedType(t._id)}
              activeOpacity={0.7}
            >
              <Text style={styles.typeEmoji}>{t.iconUrl || "📋"}</Text>
              <Text style={[styles.typeName, selectedType === t._id && styles.typeNameActive]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 校区 */}
        <Text style={styles.label}>校区 <Text style={styles.required}>*</Text></Text>
        <View style={styles.campusRow}>
          <TouchableOpacity style={[styles.campusBtn, campus === Campus.GULOU && styles.campusBtnActive]} onPress={() => setCampus(Campus.GULOU)}>
            <Text style={[styles.campusBtnText, campus === Campus.GULOU && styles.campusBtnTextActive]}>鼓楼校区</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.campusBtn, campus === Campus.XIANLIN && styles.campusBtnActive]} onPress={() => setCampus(Campus.XIANLIN)}>
            <Text style={[styles.campusBtnText, campus === Campus.XIANLIN && styles.campusBtnTextActive]}>仙林校区</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.campusBtn, campus === Campus.SUZHOU && styles.campusBtnActive]} onPress={() => setCampus(Campus.SUZHOU)}>
            <Text style={[styles.campusBtnText, campus === Campus.SUZHOU && styles.campusBtnTextActive]}>苏州校区</Text>
          </TouchableOpacity>
        </View>

        {/* Step 2: 时间 & 人数 */}
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
          <Text style={styles.stepTitle}>时间与人数</Text>
        </View>

        {/* 开始时间 */}
        <Text style={styles.label}>开始时间 <Text style={styles.required}>*</Text></Text>
        <View style={styles.dateTimeGrid}>
          <View style={styles.dtField}><Text style={styles.dtLabel}>年</Text><TextInput style={styles.dtInput} value={sY} onChangeText={setSY} keyboardType="number-pad" maxLength={4} placeholder="2026" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>月</Text><TextInput style={styles.dtInput} value={sMo} onChangeText={setSMo} keyboardType="number-pad" maxLength={2} placeholder="6" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>日</Text><TextInput style={styles.dtInput} value={sD} onChangeText={setSD} keyboardType="number-pad" maxLength={2} placeholder="6" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>时</Text><TextInput style={styles.dtInput} value={sH} onChangeText={setSH} keyboardType="number-pad" maxLength={2} placeholder="09" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>分</Text><TextInput style={styles.dtInput} value={sMi} onChangeText={setSMi} keyboardType="number-pad" maxLength={2} placeholder="00" placeholderTextColor={colors.textHint} /></View>
        </View>

        {/* 结束时间 */}
        <Text style={styles.label}>结束时间 <Text style={styles.required}>*</Text></Text>
        <View style={styles.dateTimeGrid}>
          <View style={styles.dtField}><Text style={styles.dtLabel}>年</Text><TextInput style={styles.dtInput} value={eY} onChangeText={setEY} keyboardType="number-pad" maxLength={4} placeholder="2026" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>月</Text><TextInput style={styles.dtInput} value={eMo} onChangeText={setEMo} keyboardType="number-pad" maxLength={2} placeholder="6" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>日</Text><TextInput style={styles.dtInput} value={eD} onChangeText={setED} keyboardType="number-pad" maxLength={2} placeholder="6" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>时</Text><TextInput style={styles.dtInput} value={eH} onChangeText={setEH} keyboardType="number-pad" maxLength={2} placeholder="11" placeholderTextColor={colors.textHint} /></View>
          <View style={styles.dtField}><Text style={styles.dtLabel}>分</Text><TextInput style={styles.dtInput} value={eMi} onChangeText={setEMi} keyboardType="number-pad" maxLength={2} placeholder="00" placeholderTextColor={colors.textHint} /></View>
        </View>

        {/* 容纳人数 */}
        <Text style={styles.label}>容纳人数 <Text style={styles.required}>*</Text></Text>
        <View style={styles.stepperRow}>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setCapacity(Math.max(2, capacity - 1))}>
            <Text style={styles.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <View style={styles.stepperValue}>
            <Text style={styles.stepperNumber}>{capacity}</Text>
            <Text style={styles.stepperUnit}>人</Text>
          </View>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setCapacity(Math.min(99, capacity + 1))}>
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Step 3: 地点 */}
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
          <Text style={styles.stepTitle}>集合地点</Text>
        </View>

        <Text style={styles.label}>具体地点 <Text style={styles.required}>*</Text></Text>
        <TextInput style={styles.input} placeholder="如：北大楼前草坪、二食堂门口" placeholderTextColor={colors.textHint} value={locationText} onChangeText={setLocationText} />

        <Text style={styles.label}>碰头地点（地图选点）<Text style={styles.required}>*</Text></Text>
        <TouchableOpacity style={styles.mapPick} onPress={() => navigation.navigate("MapPicker", { campus, onSelect: (coord: any) => setMeetCoord(coord) })} activeOpacity={0.8}>
          {meetCoord ? (
            <View style={styles.mapPickDone}>
              <Text style={styles.mapPickEmoji}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapPickLabel}>已选择</Text>
                <Text style={styles.mapPickCoord}>{meetCoord.lat.toFixed(5)}, {meetCoord.lng.toFixed(5)}</Text>
              </View>
              <Text style={styles.mapPickChange}>修改 ›</Text>
            </View>
          ) : (
            <View style={styles.mapPickEmpty}>
              <Text style={styles.mapPickEmptyIcon}>🗺️</Text>
              <Text style={styles.mapPickEmptyText}>点击打开地图选择集合点</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Step 4: 补充说明 */}
        <View style={styles.stepHeader}>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>4</Text></View>
          <Text style={styles.stepTitle}>补充说明</Text>
        </View>
        <TextInput style={[styles.input, styles.textarea]} placeholder="详细描述活动内容、注意事项等（选填）" placeholderTextColor={colors.textHint} value={description} onChangeText={setDescription} multiline textAlignVertical="top" />

        <TouchableOpacity style={[styles.submitBtn, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.85}>
          <Text style={styles.submitText}>{submitting ? "发起中..." : "⚓ 发起同游"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  header: {
    paddingTop: 54, paddingBottom: spacing.sm, paddingHorizontal: spacing.lg,
    backgroundColor: colors.background, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between",
    zIndex: 10,
  },
  headerTitle: { fontFamily: HAND, fontSize: 27, color: colors.ink, lineHeight: 30 },
  headerEn: { fontFamily: BODY, fontSize: 9.5, color: colors.faded, letterSpacing: 2, marginTop: 2 },
  resetBtn: { borderWidth: 1, borderColor: colors.line, borderRadius: 5, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  resetText: { ...typography.caption, color: colors.sub, fontWeight: "600" },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.xl, paddingBottom: 120 },
  stepHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg, marginTop: spacing.md },
  stepBadge: { width: 26, height: 26, borderRadius: 5, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", marginRight: spacing.sm },
  stepBadgeText: { ...typography.bodyBold, color: "#FFF", fontSize: 14 },
  stepTitle: { ...typography.h3, color: colors.textPrimary },
  label: { fontFamily: BODY, fontSize: 12.5, fontWeight: "700", color: colors.sub, letterSpacing: 2, marginBottom: spacing.sm, marginTop: spacing.md },
  required: { color: colors.error },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  typeCard: {
    width: "30%", backgroundColor: colors.card, borderRadius: 5, padding: spacing.md,
    alignItems: "center", borderWidth: 1, borderColor: colors.primary + "33",
  },
  typeCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + "0F" },
  typeEmoji: { fontSize: 28, marginBottom: spacing.xs },
  typeName: { ...typography.caption, color: colors.textSecondary, fontWeight: "600" },
  typeNameActive: { color: colors.primary },
  noTypes: { ...typography.body, color: colors.textHint, padding: spacing.md },
  campusRow: { flexDirection: "row", gap: spacing.sm },
  campusBtn: {
    flex: 1, backgroundColor: colors.card, borderRadius: 5, paddingVertical: spacing.lg,
    alignItems: "center", borderWidth: 1, borderColor: colors.primary + "33",
  },
  campusBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "0F" },
  campusEmoji: { fontSize: 32, marginBottom: spacing.xs },
  campusBtnText: { ...typography.bodyBold, color: colors.textSecondary },
  campusBtnTextActive: { color: colors.primary },
  dateTimeGrid: { flexDirection: "row", gap: spacing.xs },
  dtField: { flex: 1, alignItems: "center" },
  dtLabel: { ...typography.small, color: colors.textSecondary, marginBottom: 2 },
  dtInput: {
    ...typography.body, backgroundColor: colors.card, borderRadius: 5, borderWidth: 1,
    borderColor: colors.primary + "33", paddingVertical: spacing.sm, color: colors.textPrimary, textAlign: "center",
    fontSize: 15, fontWeight: "600", width: "100%",
  },
  stepperRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xl },
  stepperBtn: {
    width: 44, height: 44, borderRadius: 6, backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.primary + "55", justifyContent: "center", alignItems: "center",
  },
  stepperBtnText: { ...typography.h2, color: colors.primary, fontSize: 24 },
  stepperValue: { alignItems: "center" },
  stepperNumber: { ...typography.h1, color: colors.textPrimary, fontSize: 36 },
  stepperUnit: { ...typography.caption, color: colors.textSecondary },
  input: {
    ...typography.body, backgroundColor: colors.card, borderRadius: 5, borderWidth: 1,
    borderColor: colors.primary + "33", paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary,
  },
  textarea: { minHeight: 80, paddingTop: spacing.md },
  mapPick: {
    backgroundColor: colors.card, borderRadius: 5, borderWidth: 1,
    borderColor: colors.primary + "55", borderStyle: "dashed", overflow: "hidden",
  },
  mapPickEmpty: { alignItems: "center", paddingVertical: spacing.xxl },
  mapPickEmptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  mapPickEmptyText: { ...typography.body, color: colors.primary, fontWeight: "600" },
  mapPickDone: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md, backgroundColor: colors.success + "08" },
  mapPickEmoji: { fontSize: 28 },
  mapPickLabel: { ...typography.bodyBold, color: colors.success },
  mapPickCoord: { ...typography.caption, color: colors.textSecondary, fontFamily: "monospace", marginTop: 2 },
  mapPickChange: { ...typography.caption, color: colors.primary, fontWeight: "600" },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 6, borderWidth: 1.5, borderColor: colors.primaryDark,
    paddingVertical: spacing.lg, alignItems: "center", marginTop: spacing.xxl,
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...typography.button, color: colors.textOnPrimary, fontSize: 17, letterSpacing: 4 },
});
