import React, { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useAuthStore } from "../store/authStore";
import { AuthStack } from "./AuthStack";
import { MainTabs } from "./MainTabs";
import { colors } from "../theme";
import { getMe } from "../services/auth.api";

export function RootNavigator() {
  const { token, isLoggedIn, isLoading, setUser, setLoading, setToken } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [token]);

  const checkAuth = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await getMe();
      if (res.success && res.data) {
        setUser(res.data);
      } else {
        await setToken(null);
      }
    } catch (error) {
      await setToken(null);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isLoggedIn ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
