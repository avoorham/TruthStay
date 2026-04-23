import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fonts, fontSize, radius, spacing } from "../../lib/theme";
import { OnboardingButton } from "./OnboardingButton";

interface ErrorModalProps {
  visible: boolean;
  title: string;
  messages: string[];
  onClose: () => void;
}

export function ErrorModal({ visible, title, messages, onClose }: ErrorModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.messages}>
            {messages.map((msg, i) => (
              <Text key={i} style={styles.message}>
                · {msg}
              </Text>
            ))}
          </View>
          <OnboardingButton
            label="OK"
            onPress={onClose}
            variant="primary"
            style={styles.btn}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.xl,
    width: "100%",
    maxWidth: 360,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  messages: {
    marginBottom: spacing.xl,
    gap: 6,
  },
  message: {
    fontFamily: fonts.sans,
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
  },
  btn: {
    marginTop: 0,
  },
});
