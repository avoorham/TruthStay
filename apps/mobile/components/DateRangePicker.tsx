import { useState } from "react";
import {
  Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { colors, fontSize, radius, spacing } from "../lib/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function formatHeaderDate(start: Date | null, end: Date | null): string {
  if (!start) return "Select dates";
  const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  if (!end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Counter row ──────────────────────────────────────────────────────────────

function Counter({
  label, sublabel, value, min, onChange,
}: {
  label: string; sublabel?: string; value: number; min: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={cs.counterRow}>
      <View style={cs.counterLabel}>
        <Text style={cs.counterTitle}>{label}</Text>
        {sublabel ? <Text style={cs.counterSub}>{sublabel}</Text> : null}
      </View>
      <View style={cs.counterControls}>
        <TouchableOpacity
          style={[cs.counterBtn, value <= min && cs.counterBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          activeOpacity={0.7}
        >
          <Text style={cs.counterBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={cs.counterValue}>{value}</Text>
        <TouchableOpacity
          style={cs.counterBtn}
          onPress={() => onChange(value + 1)}
          activeOpacity={0.7}
        >
          <Text style={cs.counterBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarGrid({
  month, startDate, endDate,
  onDayPress,
}: {
  month: Date;
  startDate: Date | null;
  endDate: Date | null;
  onDayPress: (d: Date) => void;
}) {
  const year  = month.getFullYear();
  const mon   = month.getMonth();
  const total = daysInMonth(year, mon);
  const firstDow = new Date(year, mon, 1).getDay(); // 0=Sun

  // Build cells: leading nulls + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  // Pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  function cellDate(day: number): Date {
    return new Date(year, mon, day);
  }

  function isStart(day: number)  { return !!startDate && isSameDay(cellDate(day), startDate); }
  function isEnd(day: number)    { return !!endDate   && isSameDay(cellDate(day), endDate); }
  function isInRange(day: number): boolean {
    if (!startDate || !endDate) return false;
    const d = cellDate(day);
    return d > startDate && d < endDate;
  }
  function isPast(day: number): boolean {
    const d = cellDate(day);
    const today = new Date(); today.setHours(0,0,0,0);
    return d < today;
  }

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      {/* Weekday header */}
      <View style={cs.weekRow}>
        {WEEKDAYS.map(d => (
          <Text key={d} style={cs.weekDay}>{d}</Text>
        ))}
      </View>

      {/* Day rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={cs.weekRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={cs.dayCell} />;

            const start  = isStart(day);
            const end    = isEnd(day);
            const range  = isInRange(day);
            const past   = isPast(day);
            const today  = isToday(cellDate(day));

            return (
              <TouchableOpacity
                key={ci}
                style={[cs.dayCell, range && cs.dayCellRange]}
                onPress={() => !past && onDayPress(cellDate(day))}
                activeOpacity={past ? 1 : 0.7}
              >
                <View style={[
                  cs.dayCircle,
                  (start || end) && cs.dayCircleFilled,
                ]}>
                  <Text style={[
                    cs.dayText,
                    past  && cs.dayTextPast,
                    range && cs.dayTextRange,
                    (start || end) && cs.dayTextFilled,
                    today && !(start || end) && cs.dayTextToday,
                  ]}>
                    {day}
                  </Text>
                  {today && !(start || end) && <View style={cs.todayDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  initialStartDate?: Date;
  initialEndDate?: Date;
  onConfirm: (start: Date, end: Date, adults: number, children: number, rooms: number) => void;
  onClose: () => void;
}

export function DateRangePicker({
  visible, initialStartDate, initialEndDate, onConfirm, onClose,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    initialStartDate ? startOfMonth(initialStartDate) : startOfMonth(new Date()),
  );
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [startDate, setStartDate] = useState<Date | null>(initialStartDate ?? null);
  const [endDate,   setEndDate]   = useState<Date | null>(initialEndDate   ?? null);
  const [adults,   setAdults]   = useState(1);
  const [children, setChildren] = useState(0);
  const [rooms,    setRooms]    = useState(1);

  function handleDayPress(day: Date) {
    if (selecting === "start") {
      setStartDate(day);
      setEndDate(null);
      setSelecting("end");
    } else {
      if (startDate && day >= startDate) {
        setEndDate(day);
        setSelecting("start");
      } else {
        // Tapped before start — reset
        setStartDate(day);
        setEndDate(null);
        setSelecting("end");
      }
    }
  }

  function clearDates() {
    setStartDate(null);
    setEndDate(null);
    setSelecting("start");
  }

  function clearGuests() {
    setAdults(1);
    setChildren(0);
  }

  function prevMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  const canConfirm = !!startDate && !!endDate;
  const days = startDate && endDate ? diffDays(startDate, endDate) : 0;

  function handleConfirm() {
    if (!startDate || !endDate) return;
    onConfirm(startDate, endDate, adults, children, rooms);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={cs.overlay}>
        <View style={cs.sheet}>
          {/* Header */}
          <View style={cs.header}>
            <Text style={cs.headerTitle}>
              {canConfirm
                ? `Booking (${formatHeaderDate(startDate, endDate)})  ·  ${days} day${days !== 1 ? "s" : ""}`
                : "Select dates"}
            </Text>
            <TouchableOpacity onPress={onClose} style={cs.closeBtn} activeOpacity={0.7}>
              <Text style={cs.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={cs.scroll}>
            {/* ── Dates section ── */}
            <View style={cs.section}>
              <View style={cs.sectionHeader}>
                <Text style={cs.sectionTitle}>Dates</Text>
                <TouchableOpacity onPress={clearDates} activeOpacity={0.7}>
                  <Text style={cs.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>

              {/* Month navigation */}
              <View style={cs.monthNav}>
                <TouchableOpacity onPress={prevMonth} style={cs.navBtn} activeOpacity={0.7}>
                  <Text style={cs.navBtnText}>‹</Text>
                </TouchableOpacity>
                <Text style={cs.monthLabel}>{formatMonthYear(currentMonth)}</Text>
                <TouchableOpacity onPress={nextMonth} style={cs.navBtn} activeOpacity={0.7}>
                  <Text style={cs.navBtnText}>›</Text>
                </TouchableOpacity>
              </View>

              <CalendarGrid
                month={currentMonth}
                startDate={startDate}
                endDate={endDate}
                onDayPress={handleDayPress}
              />
            </View>

            {/* ── Guest section ── */}
            <View style={cs.section}>
              <View style={cs.sectionHeader}>
                <Text style={cs.sectionTitle}>Guest</Text>
                <TouchableOpacity onPress={clearGuests} activeOpacity={0.7}>
                  <Text style={cs.clearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              <Counter label="Adult"    sublabel="Ages 13 or above" value={adults}   min={1} onChange={setAdults} />
              <Counter label="Children" sublabel="Ages 2 or above"  value={children} min={0} onChange={setChildren} />
            </View>

            {/* ── Rooms section ── */}
            <View style={cs.section}>
              <View style={cs.sectionHeader}>
                <Text style={cs.sectionTitle}>Rooms</Text>
              </View>
              <Counter label="Rooms" value={rooms} min={1} onChange={setRooms} />
            </View>

            {/* Confirm button */}
            <TouchableOpacity
              style={[cs.confirmBtn, !canConfirm && cs.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.85}
            >
              <Text style={cs.confirmText}>
                {canConfirm ? `Confirm  ·  ${days} day${days !== 1 ? "s" : ""}` : "Select start and end date"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const DAY_SIZE = 40;

const cs = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sheet,
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    fontWeight: "600",
  },
  scroll: {
    paddingBottom: spacing.xxl,
  },

  // Section
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: "700",
    color: colors.text,
  },
  clearText: {
    fontSize: fontSize.sm,
    color: colors.muted,
    textDecorationLine: "underline",
  },

  // Month navigation
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: {
    fontSize: 20,
    color: colors.text,
    lineHeight: 24,
  },
  monthLabel: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text,
  },

  // Calendar grid
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 2,
  },
  weekDay: {
    width: DAY_SIZE,
    textAlign: "center",
    fontSize: fontSize.xs,
    color: colors.muted,
    fontWeight: "600",
    paddingBottom: spacing.sm,
  },
  dayCell: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellRange: {
    backgroundColor: colors.accentLight,
  },
  dayCircle: {
    width: DAY_SIZE - 4,
    height: DAY_SIZE - 4,
    borderRadius: (DAY_SIZE - 4) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleFilled: {
    backgroundColor: colors.text,
  },
  dayText: {
    fontSize: fontSize.sm,
    color: colors.text,
    fontWeight: "500",
  },
  dayTextPast: {
    color: colors.border,
  },
  dayTextRange: {
    color: colors.accent,
    fontWeight: "600",
  },
  dayTextFilled: {
    color: colors.inverse,
    fontWeight: "700",
  },
  dayTextToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  todayDot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },

  // Counter
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  counterLabel: {
    flex: 1,
  },
  counterTitle: {
    fontSize: fontSize.base,
    fontWeight: "600",
    color: colors.text,
  },
  counterSub: {
    fontSize: fontSize.xs,
    color: colors.muted,
    marginTop: 2,
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  counterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnDisabled: {
    borderColor: colors.border,
  },
  counterBtnText: {
    fontSize: 18,
    color: colors.text,
    fontWeight: "400",
    lineHeight: 20,
  },
  counterValue: {
    fontSize: fontSize.base,
    fontWeight: "700",
    color: colors.text,
    minWidth: 20,
    textAlign: "center",
  },

  // Confirm button
  confirmBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.text,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: colors.border,
  },
  confirmText: {
    color: colors.inverse,
    fontSize: fontSize.base,
    fontWeight: "700",
  },
});
