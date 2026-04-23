import {
  Modal, View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet, Image,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, fontSize, radius, fonts } from "../lib/theme";
import {
  type FeedComment,
  getAdventureComments, createAdventureComment,
  getPostComments, createPostComment,
} from "../lib/api";

interface CommentsSheetProps {
  visible:  boolean;
  onClose:  () => void;
  type:     "adventure" | "post";
  id:       string;
  /** Optimistically reported initial count so the caller can update its UI */
  onCountChange?: (newCount: number) => void;
}

export default function CommentsSheet({
  visible, onClose, type, id, onCountChange,
}: CommentsSheetProps) {
  const insets  = useSafeAreaInsets();
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [loading, setLoading]   = useState(false);
  const [draft, setDraft]       = useState("");
  const [posting, setPosting]   = useState(false);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!visible || !id) return;
    setLoading(true);
    const fetch = type === "adventure"
      ? getAdventureComments(id)
      : getPostComments(id);
    fetch
      .then(data => setComments(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, type, id]);

  async function handleSend() {
    if (!draft.trim() || posting) return;
    const text = draft.trim();
    setDraft("");
    setPosting(true);
    try {
      const newComment = type === "adventure"
        ? await createAdventureComment(id, text)
        : await createPostComment(id, text);
      setComments(prev => [...prev, newComment]);
      onCountChange?.(comments.length + 1);
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    } catch { /* non-fatal */ }
    finally { setPosting(false); }
  }

  function renderComment({ item }: { item: FeedComment }) {
    const initial = (item.author.displayName || item.author.username || "?")[0].toUpperCase();
    return (
      <View style={styles.commentRow}>
        {item.author.avatarUrl ? (
          <Image source={{ uri: item.author.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
        )}
        <View style={styles.commentBubble}>
          <Text style={styles.commentAuthor}>{item.author.displayName || `@${item.author.username}`}</Text>
          <Text style={styles.commentBody}>{item.body}</Text>
        </View>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.sheet, { paddingBottom: insets.bottom + spacing.sm }]}
      >
        {/* Handle + header */}
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>Comments</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <Feather name="x" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Comments list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={comments}
            keyExtractor={c => c.id}
            renderItem={renderComment}
            contentContainerStyle={[
              styles.list,
              comments.length === 0 && styles.emptyList,
            ]}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
              </View>
            }
          />
        )}

        {/* Input row */}
        <View style={styles.inputRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!draft.trim() || posting}
            style={[styles.sendBtn, (!draft.trim() || posting) && styles.sendBtnDisabled]}
          >
            {posting
              ? <ActivityIndicator size="small" color="#FFFFFF" />
              : <Feather name="send" size={18} color="#FFFFFF" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "70%",
    minHeight: 300,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  list: {
    padding: spacing.md,
    gap: spacing.md,
    flexGrow: 1,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  commentRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.accent,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  commentAuthor: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.text,
  },
  commentBody: {
    fontSize: fontSize.sm,
    color: colors.text,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: colors.subtle,
  },
});