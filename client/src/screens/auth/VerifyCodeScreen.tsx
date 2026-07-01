import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { AuthStackParamList } from "../../navigation/AuthStack";
import { verifyLogin, sendVerifyCode } from "../../services/auth.api";
import { useAuthStore } from "../../store/authStore";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "VerifyCode">;
  route: RouteProp<AuthStackParamList, "VerifyCode">;
};

export function VerifyCodeScreen({ navigation, route }: Props) {
  const { email } = route.params;
  const { setToken, setUser, setJustLoggedIn } = useAuthStore();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (text: string, index: number) => {
    if (text.length > 1) return;
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // 自动跳到下一个输入框
    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // 自动提交
    if (text && index === 5) {
      const fullCode = [...newCode.slice(0, 5), text].join("");
      if (fullCode.length === 6) handleVerify(fullCode);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const verifyCode = fullCode || code.join("");
    if (verifyCode.length !== 6) {
      Alert.alert("提示", "请输入6位验证码");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyLogin(email, verifyCode);
      if (res.success && res.data) {
        setJustLoggedIn(true);
        await setToken(res.data.token);
        if (res.data.isNewUser) {
          navigation.navigate("Welcome");
        }
        // 如果不是新用户，RootNavigator会自动切换到MainTabs
      } else {
        Alert.alert("验证失败", res.error || "验证码不正确");
      }
    } catch (err: any) {
      Alert.alert("错误", err?.error || err?.message || "验证失败");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    try {
      await sendVerifyCode(email);
      setCountdown(60);
      Alert.alert("已发送", "验证码已重新发送");
    } catch (err: any) {
      Alert.alert("发送失败", err?.error || "请稍后再试");
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>

        <Text style={styles.title}>输入验证码</Text>
        <Text style={styles.subtitle}>验证码已发送至 {email}</Text>

        <View style={styles.codeRow}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputs.current[index] = ref; }}
              style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
              value={digit}
              onChangeText={(text) => handleCodeChange(text, index)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => handleVerify()}
          disabled={loading || code.join("").length !== 6}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{loading ? "验证中..." : "登录 / 注册"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
          <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
            {countdown > 0 ? `${countdown}秒后重新发送` : "重新发送验证码"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.xxxl,
    alignItems: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.xxl,
  },
  backText: {
    ...typography.body,
    color: colors.primary,
  },
  title: {
    fontFamily: HAND,
    fontSize: 30,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xxxl,
    textAlign: "center",
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    marginBottom: spacing.xxxl,
  },
  codeInput: {
    width: 48,
    height: 60,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary + "33",
    backgroundColor: colors.card,
    textAlign: "center",
    ...typography.h2,
    color: colors.textPrimary,
  },
  codeInputFilled: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  button: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.primaryDark,
    paddingVertical: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typography.button,
    color: colors.textOnPrimary,
  },
  resendText: {
    ...typography.body,
    color: colors.primary,
  },
  resendDisabled: {
    color: colors.textHint,
  },
});
