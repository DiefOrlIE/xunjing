import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, typography, spacing, HAND } from "../theme";
import { WhaleMark, Waveform } from "../theme/whaleKit";

interface EmptyStateProps {
  emoji?: string; // 兼容旧调用，已不再渲染 emoji
  title: string;
  subtitle?: string;
}

export function EmptyState({ title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.mark}><WhaleMark size={46} color={colors.primary} eye="#fff" /></View>
      <Waveform w={120} h={10} color={colors.secondary} sw={1.5} opacity={0.7} />
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxxl,
  },
  mark: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.primary + "12", borderWidth: 1, borderColor: colors.primary + "33",
    alignItems: "center", justifyContent: "center", marginBottom: spacing.md,
  },
  title: { fontFamily: HAND, fontSize: 22, color: colors.ink, textAlign: "center", marginTop: spacing.md },
  subtitle: { ...typography.body, color: colors.textHint, marginTop: spacing.sm, textAlign: "center" },
});
