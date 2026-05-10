// TODO(design-sweep): selected-date circle uses colors.text (dark) — sweep to accent blue
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
function isPast(d: Date): boolean {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
}
function formatMonthYear(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CalendarGrid({
  month, startDate, endDate, onDayPress,
}: {
  month: Date;
  startDate: Date | null;
  endDate: Date | null;
  onDayPress: (d: Date) => void;
}) {
  const year  = month.getFullYear();
  const mon   = month.getMonth();
  const total = daysInMonth(year, mon);
  const firstDow = new Date(year, mon, 1).getDay();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function cellDate(day: number) { return new Date(year, mon, day); }
  function isStart(day: number)  { return !!startDate && isSameDay(cellDate(day), startDate); }
  function isEnd(day: number)    { return !!endDate   && isSameDay(cellDate(day), endDate); }
  function isInRange(day: number): boolean {
    if (!startDate || !endDate) return false;
    const d = cellDate(day);
    return d > startDate && d < endDate;
  }

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={cs.weekRow}>
        {WEEKDAYS.map(d => <Text key={d} style={cs.weekDay}>{d}</Text>)}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={cs.weekRow}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={cs.dayCell} />;
            const start = isStart(day);
            const end   = isEnd(day);
            const range = isInRange(day);
            const past  = isPast(cellDate(day));
            const today = isToday(cellDate(day));
            return (
              <TouchableOpacity
                key={ci}
                style={[cs.dayCell, range && cs.dayCellRange]}
                onPress={() => !past && onDayPress(cellDate(day))}
                activeOpacity={past ? 1 : 0.7}
              >
                <View style={[cs.dayCircle, (start || end) && cs.dayCircleFilled]}>
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

// ─── InlineCalendar ───────────────────────────────────────────────────────────

export interface InlineCalendarProps {
  startDate: Date | null;
  endDate:   Date | null;
  onChange:  (start: Date | null, end: Date | null) => void;
}

export function InlineCalendar({ startDate, endDate, onChange }: InlineCalendarProps) {
  // currentMonth is self-managed — defaults to today's month
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => startOfMonth(new Date()),
  );

  function handleDayPress(day: Date) {
    if (!startDate || (startDate && endDate)) {
      // Begin a new range
      onChange(day, null);
    } else if (day >= startDate) {
      onChange(startDate, day);
    } else {
      // Tapped before start — restart
      onChange(day, null);
    }
  }

  const nights = startDate && endDate ? diffDays(startDate, endDate) : null;

  return (
    <View>
      {/* Month navigation */}
      <View style={cs.monthNav}>
        <TouchableOpacity
          style={cs.navBtn}
          onPress={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          activeOpacity={0.7}
        >
          <Text style={cs.navBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={cs.monthLabel}>{formatMonthYear(currentMonth)}</Text>
        <TouchableOpacity
          style={cs.navBtn}
          onPress={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          activeOpacity={0.7}
        >
          <Text style={cs.navBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      <CalendarGrid
        month={currentMonth}
        startDate={startDate}
        endDate={endDate}
        onDayPress={handleDayPress}
      />

      {/* "N nights · N+1 days" summary */}
      {nights !== null && nights > 0 ? (
        <View style={cs.summary}>
          <Text style={cs.summaryText}>
            {nights} night{nights !== 1 ? "s" : ""} · {nights + 1} day{nights + 1 !== 1 ? "s" : ""}
          </Text>
        </View>
      ) : startDate && !endDate ? (
        <View style={cs.summary}>
          <Text style={cs.summaryHint}>Tap an end date</Text>
        </View>
      ) : null}
    </View>
  );
}

// React import needed for useState inside the named export
import React from "react";

// ─── Styles ───────────────────────────────────────────────────────────────────

const DAY_SIZE = 40;

const cs = StyleSheet.create({
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  navBtnText: { fontSize: 20, color: colors.text, lineHeight: 24 },
  monthLabel: { fontSize: fontSize.base, fontWeight: "700", color: colors.text } as object,

  weekRow:  { flexDirection: "row", justifyContent: "space-around", marginBottom: 2 },
  weekDay:  { width: DAY_SIZE, textAlign: "center", fontSize: fontSize.xs, color: colors.muted, fontWeight: "600", paddingBottom: spacing.sm } as object,
  dayCell:  { width: DAY_SIZE, height: DAY_SIZE, alignItems: "center", justifyContent: "center" },
  dayCellRange: { backgroundColor: colors.accentLight },
  dayCircle:    { width: DAY_SIZE - 4, height: DAY_SIZE - 4, borderRadius: (DAY_SIZE - 4) / 2, alignItems: "center", justifyContent: "center" },
  dayCircleFilled: { backgroundColor: colors.accent },
  dayText:     { fontSize: fontSize.sm, color: colors.text, fontWeight: "500" } as object,
  dayTextPast: { color: colors.border },
  dayTextRange:  { color: colors.accent, fontWeight: "600" } as object,
  dayTextFilled: { color: colors.inverse, fontWeight: "700" } as object,
  dayTextToday:  { color: colors.accent, fontWeight: "700" } as object,
  todayDot:    { position: "absolute", bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },

  summary: { alignItems: "center", marginTop: spacing.sm, marginBottom: spacing.xs },
  summaryText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.accent } as object,
  summaryHint: { fontSize: fontSize.sm, color: colors.muted } as object,
});
