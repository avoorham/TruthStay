import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, fonts, fontSize, radius, spacing, shadow } from "../lib/theme";

export interface AppAlertButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

interface Props {
  config: AlertConfig | null;
  onDismiss: () => void;
}

function AppAlertModal({ config, onDismiss }: Props) {
  if (!config) return null;
  const { title, message, buttons } = config;
  const stacked = buttons.length > 2;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={[styles.btnRow, stacked && styles.btnRowStacked]}>
            {buttons.map((btn, i) => {
              const isDestructive = btn.style === "destructive";
              const isCancel = btn.style === "cancel";
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    stacked && styles.btnFull,
                    !stacked && buttons.length === 2 && styles.btnHalf,
                    isDestructive && styles.btnDestructive,
                    isCancel && styles.btnCancel,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => { onDismiss(); btn.onPress?.(); }}
                >
                  <Text
                    style={[
                      styles.btnText,
                      isDestructive && styles.btnTextDestructive,
                      isCancel && styles.btnTextCancel,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function useAppAlert() {
  const [config, setConfig] = React.useState<AlertConfig | null>(null);

  const showAlert = React.useCallback(
    (title: string, message?: string, buttons?: AppAlertButton[]) => {
      setConfig({
        title,
        message,
        buttons: buttons ?? [{ text: "OK", style: "default" }],
      });
    },
    [],
  );

  const dismiss = React.useCallback(() => setConfig(null), []);

  const modal = <AppAlertModal config={config} onDismiss={dismiss} />;

  return { showAlert, modal };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    width: "100%",
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.lg,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.lg,
    color: colors.navy,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  message: {
    fontFamily: fonts.sans,
    fontSize: fontSize.base,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  btnRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  btnRowStacked: {
    flexDirection: "column",
  },
  btn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  btnFull: {
    flex: 0,
  },
  btnHalf: {
    flex: 1,
  },
  btnDestructive: {
    backgroundColor: "#E53E3E",
  },
  btnCancel: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnText: {
    fontFamily: fonts.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.inverse,
  },
  btnTextDestructive: {
    color: colors.inverse,
  },
  btnTextCancel: {
    color: colors.muted,
  },
});
