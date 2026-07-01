import React, { useState, useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Text, View, StyleSheet } from "react-native";
import { colors, BODY } from "../theme";
import { Waveform } from "../theme/whaleKit";
import { TutorialModal } from "../components/TutorialModal";
import { useAuthStore } from "../store/authStore";

// 屏幕
import { MapScreen } from "../screens/map/MapScreen";
import { EventDetailScreen } from "../screens/log/EventDetailScreen";
import { GalleryScreen } from "../screens/gallery/GalleryScreen";
import { ItemDetailScreen } from "../screens/gallery/ItemDetailScreen";
import { ProfileScreen } from "../screens/profile/ProfileScreen";
import { AdminPanelScreen } from "../screens/admin/AdminPanelScreen";
import { FriendListScreen } from "../screens/friends/FriendListScreen";
import { ChatScreen } from "../screens/friends/ChatScreen";
import { UserGalleryScreen } from "../screens/gallery/UserGalleryScreen";
import { PublishEventScreen } from "../screens/publish/PublishEventScreen";
import { MapPickerScreen } from "../screens/publish/MapPickerScreen";
import { WriteNoteScreen } from "../screens/note/WriteNoteScreen";
import { FeedbackScreen } from "../screens/profile/FeedbackScreen";
import { GroupChatScreen } from "../screens/log/GroupChatScreen";
import { ActivitySquareScreen } from "../screens/log/ActivitySquareScreen";
import { LogFeedScreen } from "../screens/log/LogFeedScreen";

export type MainTabParamList = {
  FriendsTab: undefined;
  PublishTab: undefined;
  SquareTab: undefined;
  MapTab: undefined;
  GalleryTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

// ── 各 Tab 的 Stack ──
const GalleryStackNav = createStackNavigator();
function GalleryStack() {
  return (
    <GalleryStackNav.Navigator screenOptions={{ headerShown: false }}>
      <GalleryStackNav.Screen name="GalleryMain" component={GalleryScreen} />
      <GalleryStackNav.Screen name="ItemDetail" component={ItemDetailScreen} />
    </GalleryStackNav.Navigator>
  );
}

const FriendsStackNav = createStackNavigator();
function FriendsStack() {
  return (
    <FriendsStackNav.Navigator screenOptions={{ headerShown: false }}>
      <FriendsStackNav.Screen name="FriendsMain" component={FriendListScreen} />
      <FriendsStackNav.Screen name="Chat" component={ChatScreen} />
      <FriendsStackNav.Screen name="UserGallery" component={UserGalleryScreen} />
    </FriendsStackNav.Navigator>
  );
}

const PublishStackNav = createStackNavigator();
function PublishStack() {
  return (
    <PublishStackNav.Navigator screenOptions={{ headerShown: false }}>
      <PublishStackNav.Screen name="PublishMain" component={PublishEventScreen} />
      <PublishStackNav.Screen name="MapPicker" component={MapPickerScreen} />
    </PublishStackNav.Navigator>
  );
}

const SquareStackNav = createStackNavigator();
function SquareStack() {
  return (
    <SquareStackNav.Navigator screenOptions={{ headerShown: false }}>
      <SquareStackNav.Screen name="SquareMain" component={ActivitySquareScreen} />
      <SquareStackNav.Screen name="EventDetail" component={EventDetailScreen} />
      <SquareStackNav.Screen name="GroupChat" component={GroupChatScreen} />
      <SquareStackNav.Screen name="UserGallery" component={UserGalleryScreen} />
    </SquareStackNav.Navigator>
  );
}

const MapStackNav = createStackNavigator();
function MapStack() {
  return (
    <MapStackNav.Navigator screenOptions={{ headerShown: false }}>
      <MapStackNav.Screen name="MapMain" component={MapScreen} />
      <MapStackNav.Screen name="WriteNote" component={WriteNoteScreen} />
      <MapStackNav.Screen name="EventDetail" component={EventDetailScreen} />
      <MapStackNav.Screen name="GroupChat" component={GroupChatScreen} />
      <MapStackNav.Screen name="UserGallery" component={UserGalleryScreen} />
    </MapStackNav.Navigator>
  );
}

const ProfileStackNav = createStackNavigator();
function ProfileStack() {
  return (
    <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStackNav.Screen name="AdminPanel" component={AdminPanelScreen} />
      <ProfileStackNav.Screen name="MapPicker" component={MapPickerScreen} />
      <ProfileStackNav.Screen name="Feedback" component={FeedbackScreen} />
      <ProfileStackNav.Screen name="LogFeed" component={LogFeedScreen} />
      <ProfileStackNav.Screen name="EventDetail" component={EventDetailScreen} />
      <ProfileStackNav.Screen name="GroupChat" component={GroupChatScreen} />
      <ProfileStackNav.Screen name="UserGallery" component={UserGalleryScreen} />
    </ProfileStackNav.Navigator>
  );
}

// ── Tab Icon（航海志：纯文字 + 选中波形下划线，无 emoji）──
const TabIcon = ({ label, focused }: { label: string; focused: boolean }) => (
  <View style={styles.tabIcon}>
    <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>{label}</Text>
    {focused ? <Waveform w={24} h={6} color={colors.accent} sw={1.6} /> : <View style={{ height: 6 }} />}
  </View>
);

export function MainTabs() {
  const { justLoggedIn, setJustLoggedIn } = useAuthStore();
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (justLoggedIn) {
      const t = setTimeout(() => setShowTutorial(true), 500);
      return () => clearTimeout(t);
    }
  }, [justLoggedIn]);

  const handleTutorialDone = () => {
    setShowTutorial(false);
    setJustLoggedIn(false);
  };

  return (
    <>
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
      }}
    >
      <Tab.Screen name="FriendsTab" component={FriendsStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="好友" focused={focused} /> }} />
      <Tab.Screen name="PublishTab" component={PublishStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="发布" focused={focused} /> }} />
      <Tab.Screen name="SquareTab" component={SquareStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="活动广场" focused={focused} /> }} />
      <Tab.Screen name="MapTab" component={MapStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="地图" focused={focused} /> }} />
      <Tab.Screen name="GalleryTab" component={GalleryStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="展柜" focused={focused} /> }} />
      <Tab.Screen name="ProfileTab" component={ProfileStack}
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="我" focused={focused} /> }} />
    </Tab.Navigator>
    <TutorialModal visible={showTutorial} onDone={handleTutorialDone} />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.tabBackground,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 20,
    paddingTop: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tabIcon: { alignItems: "center", justifyContent: "center", maxWidth: 72, gap: 3 },
  label: { fontFamily: BODY, fontSize: 13, color: colors.tabInactive, fontWeight: "500", textAlign: "center" },
  labelActive: { color: colors.tabActive, fontWeight: "700" },
});
