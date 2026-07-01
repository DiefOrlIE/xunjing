import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, Platform, Keyboard, Alert, Dimensions,
} from "react-native";
import { colors, typography, spacing, borderRadius, HAND } from "../../theme";
import { Avatar } from "../../components/Avatar";
import { MessageBubble } from "../../components/MessageBubble";
import { getPrivateChatHistory, sendPrivateMessage, revokeMessage, deleteMessageApi } from "../../services/chat.api";
import { getSocket, getCurrentSocket } from "../../socket/socketClient";
import { MessageData } from "../../types";
import { useAuthStore } from "../../store/authStore";

export function ChatScreen({ route, navigation }: any) {
  const { friend } = route.params;
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [inputText, setInputText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [loading, setLoading] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: MessageData; index: number; isMine: boolean; canRecall: boolean } | null>(null);
  const menuDebounceRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const EMOJIS = ["😊","😂","❤️","👍","🎉","🔥","😍","🤔","👋","💪","🙏","✨","🌟","💯","🥳"];
  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef(getCurrentSocket());
  const nearBottomRef = useRef(true);

  // 当前会话ID，用于过滤socket消息防止串线
  const currentConvId = useMemo(
    () => [user?.id || user?._id || "", friend.id].sort().join("_"),
    [user?.id, user?._id, friend.id]
  );

  // 加载历史消息
  useEffect(() => {
    (async () => {
      try {
        const res = await getPrivateChatHistory(friend.id);
        if (res.success && res.data) setMessages(res.data.messages);
      } catch {} finally { setLoading(false); }
    })();
  }, [friend.id]);

  // Socket 监听新消息 + 撤回 + 删除
  useEffect(() => {
    const setupSocket = async () => {
      const socket = await getSocket();
      if (!socket) return;
      socketRef.current = socket;

      const handleNewMessage = (data: any) => {
        if (data.conversationId === currentConvId && data.message.senderId !== (user?.id || user?._id)) {
          setMessages((prev) => [...prev, data.message]);
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      };

      const handleMessageRevoked = (data: any) => {
        if (!data?.messageId) return;
        if (data.conversationId && data.conversationId !== currentConvId) return;
        setMessages((prev) => prev.map((m) =>
          m._id === data.messageId ? { ...m, isRevoked: true } : m
        ));
      };

      const handleMessageDeleted = (data: any) => {
        if (!data?.messageId) return;
        if (data.conversationId && data.conversationId !== currentConvId) return;
        setMessages((prev) => prev.filter((m) => m._id !== data.messageId));
      };

      socket.on("new_private_message", handleNewMessage);
      socket.on("message_revoked", handleMessageRevoked);
      socket.on("message_deleted", handleMessageDeleted);
      return () => {
        socket.off("new_private_message", handleNewMessage);
        socket.off("message_revoked", handleMessageRevoked);
        socket.off("message_deleted", handleMessageDeleted);
      };
    };
    setupSocket();
  }, [currentConvId]);

  // 键盘避让：监听键盘高度，将输入框顶到键盘正上方
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (e: any) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // 撤回消息
  const handleRecall = async (item: MessageData, index: number) => {
    setMenuIndex(null);
    setContextMenu(null);
    if (!item._id) {
      // 乐观发送的消息还没有服务器 _id，按内容+时间从本地移除
      setMessages((prev) => prev.filter((m) => !(m.senderId === item.senderId && m.content === item.content && m.createdAt === item.createdAt)));
      return;
    }
    try {
      const res = await revokeMessage(item._id);
      if (res.success) {
        setMessages((prev) => prev.map((m) => (m._id === item._id ? { ...m, isRevoked: true } : m)));
      } else {
        Alert.alert("撤回失败", (res as any).error || "请稍后重试");
      }
    } catch (e: any) { Alert.alert("撤回失败", e?.error || "网络错误"); }
  };

  // 删除消息
  const handleDelete = async (item: MessageData, index: number) => {
    setMenuIndex(null);
    setContextMenu(null);
    if (!item._id) {
      // 乐观发送的消息还没有服务器 _id，按内容+时间从本地移除
      setMessages((prev) => prev.filter((m) => !(m.senderId === item.senderId && m.content === item.content && m.createdAt === item.createdAt)));
      return;
    }
    try {
      const res = await deleteMessageApi(item._id);
      if (res.success) {
        setMessages((prev) => prev.filter((m) => m._id !== item._id));
      } else {
        Alert.alert("删除失败", (res as any).error || "请稍后重试");
      }
    } catch (e: any) { Alert.alert("删除失败", e?.error || "网络错误"); }
  };

  // 长按/右键：弹出消息菜单（允许对所有未撤回消息操作）
  const handleLongPress = (item: MessageData, index: number) => {
    if (item.isRevoked) return;
    setMenuIndex(index);
  };

  // Web 端：在点击/长按位置弹出浮层菜单
  // e: 事件对象（可为 null，此时使用 explicitX/explicitY）
  const showWebContextMenu = (e: any, item: MessageData, index: number, isMine: boolean, canRecall: boolean, explicitX?: number, explicitY?: number) => {
    if (item.isRevoked) return;
    const now = Date.now();
    if (now - menuDebounceRef.current < 300) return; // 防止 onLongPress + onContextMenu 重复触发
    menuDebounceRef.current = now;
    const win = Dimensions.get("window");
    const rawX: number = explicitX ?? e?.nativeEvent?.clientX ?? e?.nativeEvent?.pageX ?? 0;
    const rawY: number = explicitY ?? e?.nativeEvent?.clientY ?? e?.nativeEvent?.pageY ?? 0;
    // 菜单大约宽 130px 高 44px，保证不超出屏幕
    const menuW = 130;
    const menuH = 50;
    const x = Math.min(rawX, win.width - menuW - 8);
    const y = Math.max(8, rawY - menuH - 4);
    setContextMenu({ x, y, item, index, isMine, canRecall });
  };

  // 发送消息
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    const msg: MessageData = {
      senderId: user?.id || user?._id || "",
      senderNickname: user?.nickname || "",
      senderAvatar: user?.avatar || "",
      content: text,
      contentType: "text",
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, msg]);
    setInputText("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    // REST API 发送（保证存储）
    try { await sendPrivateMessage(friend.id, text); } catch {}

    // Socket 推送（实时通知对方）
    if (socketRef.current?.connected) {
      const convId = [user?.id || user?._id, friend.id].sort().join("_");
      socketRef.current.emit("private_message", {
        conversationId: convId,
        receiverId: friend.id,
        content: text,
        contentType: "text",
      });
    }
  };

  // 标记已读
  useEffect(() => {
    const markRead = async () => {
      const socket = socketRef.current;
      if (!socket) return;
      const convId = [user?.id || user?._id, friend.id].sort().join("_");
      socket.emit("mark_read", { conversationId: convId, conversationType: "private" });
    };
    markRead();
  }, [messages.length]);

  const renderMessage = useCallback(({ item, index }: { item: MessageData; index: number }) => {
    const isMine = String(item.senderId) === String(user?.id || user?._id || "");
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const showAvatar = !prevMsg || prevMsg.senderId !== item.senderId;
    const showMenu = menuIndex === index;
    const elapsed = Date.now() - new Date(item.createdAt).getTime();
    // 容错：createdAt无效时 elapsed 为 NaN，视为刚发送（允许撤回）
    const safeElapsed = isNaN(elapsed) ? 0 : elapsed;
    const canRecall = isMine && safeElapsed <= 1 * 60 * 1000;
    const isWeb = Platform.OS === "web";

    return (
      <View style={menuStyles.msgRow}>
        {/* 原生端：消息菜单（浮在气泡上方） */}
        {!isWeb && showMenu && (
          <View style={[menuStyles.menuBar, isMine ? menuStyles.menuBarMine : menuStyles.menuBarOther]}>
            {canRecall && (
              <TouchableOpacity style={menuStyles.menuBtn} onPress={() => handleRecall(item, index)} activeOpacity={0.6}>
                <Text style={menuStyles.menuBtnText}>撤回</Text>
              </TouchableOpacity>
            )}
            {/* 删除按钮对所有消息显示（含对方消息） */}
            <TouchableOpacity style={menuStyles.menuBtn} onPress={() => handleDelete(item, index)} activeOpacity={0.6}>
              <Text style={[menuStyles.menuBtnText, menuStyles.menuBtnDel]}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Web 端：自定义长按（onTouchStart+定时器）+ 右键 */}
        {/* @ts-expect-error onContextMenu 仅 Web DOM 支持 */}
        <View
          onTouchStart={
            isWeb
              ? (e: any) => {
                  touchPosRef.current = {
                    x: e.nativeEvent?.pageX ?? e.nativeEvent?.locationX ?? 0,
                    y: e.nativeEvent?.pageY ?? e.nativeEvent?.locationY ?? 0,
                  };
                  if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = setTimeout(() => {
                    showWebContextMenu(null, item, index, isMine, canRecall, touchPosRef.current.x, touchPosRef.current.y);
                  }, 500);
                }
              : undefined
          }
          onTouchEnd={
            isWeb
              ? () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }
              : undefined
          }
          onTouchMove={
            isWeb
              ? () => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }
              : undefined
          }
          onLongPress={
            isWeb
              ? undefined // Web 端用自定义 onTouchStart 代替，避免与 ScrollView 冲突
              : () => handleLongPress(item, index)
          }
          onContextMenu={
            isWeb
              ? (e: any) => { e.preventDefault(); showWebContextMenu(e, item, index, isMine, canRecall); }
              : undefined
          }
          style={isWeb ? ({ userSelect: "none", WebkitTouchCallout: "none", cursor: "default" } as any) : undefined}
        >
          <MessageBubble
            content={item.content}
            isMine={isMine}
            senderNickname={item.senderNickname}
            senderAvatar={item.senderAvatar}
            timestamp={item.createdAt}
            showAvatar={showAvatar}
            isRevoked={item.isRevoked}
          />
        </View>
      </View>
    );
  }, [menuIndex, user?.id, user?._id, messages]);

  return (
    <View style={[styles.container, { paddingBottom: keyboardHeight }]}>
      {/* 顶栏 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Avatar uri={friend.avatar || undefined} size={36} emoji={friend.nickname?.charAt(0) || "?"} />
        <Text style={styles.headerName} numberOfLines={1}>{friend.nickname || "好友"}</Text>
        <TouchableOpacity
          style={styles.galleryBtn}
          onPress={() => navigation.navigate("UserGallery", { userId: friend.userId, nickname: friend.nickname })}
        >
          <Text style={styles.galleryBtnText}>🏛️</Text>
        </TouchableOpacity>
      </View>

      {/* 消息列表 */}
      <View style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id || `${item.senderId}-${item.createdAt}`}
          renderItem={renderMessage}
          removeClippedSubviews={Platform.OS === "android"}
          maxToRenderPerBatch={10}
          windowSize={11}
          initialNumToRender={20}
          contentContainerStyle={[styles.msgList, messages.length === 0 && styles.msgListEmpty]}
          onContentSizeChange={() => { if (nearBottomRef.current) { flatListRef.current?.scrollToEnd({ animated: false }); } }}
          onScroll={(e: any) => {
            const { contentSize, contentOffset, layoutMeasurement } = e.nativeEvent;
            const dist = contentSize.height - contentOffset.y - layoutMeasurement.height;
            nearBottomRef.current = dist < 200;
          }}
          onScrollBeginDrag={() => { setMenuIndex(null); setContextMenu(null); }}
          scrollEventThrottle={16}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyText}>开始聊天吧！</Text>
            </View>
          }
        />
      </View>

      {/* 输入栏 */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.emojiBtn} onPress={() => setShowEmoji(!showEmoji)}>
          <Text style={styles.emojiBtnText}>😊</Text>
        </TouchableOpacity>
        {showEmoji && (
          <View style={styles.emojiPicker}>
            {EMOJIS.map((e, i) => (
              <TouchableOpacity key={i} onPress={() => { setInputText((prev) => prev + e); setShowEmoji(false); }}>
                <Text style={styles.emojiItem}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="输入消息..."
          placeholderTextColor={colors.textHint}
          maxLength={500}
          blurOnSubmit={false}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim()}
          activeOpacity={0.7}
        >
          <Text style={styles.sendBtnText}>发送</Text>
        </TouchableOpacity>
      </View>

      {/* Web 端：固定定位的浮层菜单（解决 FlatList 裁剪问题） */}
      {contextMenu && Platform.OS === "web" && (
        <>
          {/* 全屏透明遮罩：点击任意空白处关闭菜单 */}
          <View
            style={overlayStyles.backdrop}
            onClick={() => setContextMenu(null)}
          />
          {/* 菜单本体 */}
          <View style={[overlayStyles.menu, { left: contextMenu.x, top: contextMenu.y }]}>
            {contextMenu.canRecall && (
              <TouchableOpacity
                style={overlayStyles.menuItem}
                onPress={() => handleRecall(contextMenu.item, contextMenu.index)}
                activeOpacity={0.6}
              >
                <Text style={overlayStyles.menuItemText}>撤回</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={overlayStyles.menuItem}
              onPress={() => handleDelete(contextMenu.item, contextMenu.index)}
              activeOpacity={0.6}
            >
              <Text style={[overlayStyles.menuItemText, overlayStyles.menuItemDel]}>删除</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 56, paddingBottom: spacing.sm, paddingHorizontal: spacing.md,
    backgroundColor: colors.surface, flexDirection: "row", alignItems: "center",
    borderBottomLeftRadius: borderRadius.lg, borderBottomRightRadius: borderRadius.lg,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 4, zIndex: 10,
    gap: spacing.sm,
  },
  backBtn: { paddingHorizontal: spacing.xs },
  backText: { ...typography.h2, color: colors.primary },
  headerName: { fontFamily: HAND, fontSize: 20, color: colors.ink, flex: 1 },
  galleryBtn: { padding: spacing.sm },
  galleryBtnText: { fontSize: 22 },
  msgList: { paddingVertical: spacing.md, flexGrow: 1 },
  msgListEmpty: { justifyContent: "center", alignItems: "center" },
  emptyChat: { alignItems: "center", paddingTop: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.body, color: colors.textHint },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", backgroundColor: colors.surface,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm,
  },
  emojiBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  emojiBtnText: { fontSize: 24 },
  emojiPicker: { flexDirection: "row", flexWrap: "wrap", backgroundColor: colors.surface, padding: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, position: "absolute", bottom: 60, left: spacing.md, right: spacing.md, gap: spacing.xs, justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 6 },
  emojiItem: { fontSize: 28, padding: spacing.xs },
  textInput: {
    flex: 1, ...typography.body, backgroundColor: colors.background,
    borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    maxHeight: 100, color: colors.textPrimary,
  },
  sendBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { ...typography.bodyBold, color: "#FFF" },
});

// ── 消息菜单样式 ──
const menuStyles = StyleSheet.create({
  msgRow: { position: "relative" },
  menuBar: {
    flexDirection: "row",
    backgroundColor: "#2C2C2C",
    borderRadius: borderRadius.md,
    paddingHorizontal: 2,
    paddingVertical: 2,
    marginBottom: 4,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  menuBarMine: { alignSelf: "flex-end", marginRight: 58 },
  menuBarOther: { alignSelf: "flex-start", marginLeft: 58 },
  menuBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuBtnText: {
    ...typography.caption,
    color: "#FFF",
    fontWeight: "700",
  },
  menuBtnDel: {
    color: "#FF6B6B",
  },
  menuSep: {
    width: 1,
    backgroundColor: "#555",
    marginVertical: 4,
  },
});

// ── Web 端浮层菜单样式（position:fixed 避免被 FlatList 裁剪） ──
const overlayStyles = StyleSheet.create({
  backdrop: {
    position: "fixed" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9998,
  },
  menu: {
    position: "fixed" as any,
    zIndex: 9999,
    flexDirection: "row",
    backgroundColor: "#2C2C2C",
    borderRadius: borderRadius.md,
    paddingHorizontal: 2,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  menuItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    cursor: "pointer",
  },
  menuItemText: {
    ...typography.caption,
    color: "#FFF",
    fontWeight: "700",
  } as any,
  menuItemDel: {
    color: "#FF6B6B",
  } as any,
});
