"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DragDropContext, Droppable, Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, Search, Filter, Calendar, LayoutGrid, List,
  ChevronLeft, ChevronRight, Bot, User, Users,
  X, Zap, CheckCircle2, ChevronDown,
} from "lucide-react";
import {
  format, startOfWeek, addDays, addWeeks, isSameDay,
  isToday, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, addMonths,
} from "date-fns";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Campaign = {
  id: string;
  name: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduled_at: string | null;
  sent_at: string | null;
  recipient_count: number | null;
  open_rate: number | null;
  click_rate: number | null;
  created_at: string;
  channel?: "email" | "push" | "both";
  segment_label?: string | null;
  agent_rationale?: string | null;
  created_by?: "agent" | "manual";
  estimated_cost?: number | null;
};

type View = "kanban" | "table" | "planner";
type PlannerMode = "week" | "month";

// ─── Constants ────────────────────────────────────────────────────────────────

const KANBAN_COLS = [
  { id: "draft",     label: "Draft",     dot: "bg-grey-300",  head: "text-grey-500",   bg: "bg-slate-100/60" },
  { id: "scheduled", label: "Scheduled", dot: "bg-blue",       head: "text-blue",        bg: "bg-blue-light/30" },
  { id: "sending",   label: "Sending",   dot: "bg-warning",    head: "text-warning",     bg: "bg-warning-light/30" },
  { id: "sent",      label: "Sent",      dot: "bg-green-dark", head: "text-green-dark",  bg: "bg-green-light/30" },
  { id: "cancelled", label: "Cancelled", dot: "bg-danger",     head: "text-danger",      bg: "bg-danger-light/30" },
];

// ─── Mock data (used when DB returns nothing) ──────────────────────────────────

const rel = (offsetDays: number, hour = 9): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const MOCK_CAMPAIGNS: Campaign[] = [
  { id: "m1", name: "Churn Prevention — Cycling France", subject: "We miss you! Your next adventure awaits", status: "draft", scheduled_at: null, sent_at: null, recipient_count: 84, open_rate: null, click_rate: null, created_at: rel(-2), channel: "email", segment_label: "Cycling + France", agent_rationale: "Identified 84 users interested in cycling in France who haven't logged in for 21+ days. A personalised re-engagement email highlighting new Provence routes could recover 15–20 users.", created_by: "agent" },
  { id: "m2", name: "Win-back Inactive Users", subject: "New destinations just for you", status: "draft", scheduled_at: null, sent_at: null, recipient_count: 120, open_rate: null, click_rate: null, created_at: rel(-1), channel: "push", segment_label: "Inactive 30d+", agent_rationale: "Push notification to re-surface personalised destination picks for users inactive for 30+ days.", created_by: "agent" },
  { id: "m3", name: "Algarve Summer Launch", subject: "Discover Portugal's golden coast", status: "draft", scheduled_at: null, sent_at: null, recipient_count: 56, open_rate: null, click_rate: null, created_at: rel(0), channel: "email", segment_label: "Beach interest", created_by: "manual" },
  { id: "m4", name: "Push Trip Reminder — Italy", subject: "Your Rome trip starts in 48h", status: "scheduled", scheduled_at: rel(2, 8), sent_at: null, recipient_count: 230, open_rate: null, click_rate: null, created_at: rel(-3), channel: "push", segment_label: "Active bookings" },
  { id: "m5", name: "Summer Destinations Newsletter", subject: "Top 10 summer hotspots for 2026", status: "scheduled", scheduled_at: rel(4, 10), sent_at: null, recipient_count: 1850, open_rate: null, click_rate: null, created_at: rel(-4), channel: "email", segment_label: "All users" },
  { id: "m6", name: "Weekend Getaways — May", subject: "Perfect weekend trips near you", status: "sending", scheduled_at: rel(0, 9), sent_at: null, recipient_count: 445, open_rate: null, click_rate: null, created_at: rel(-5), channel: "email", segment_label: "City break interest" },
  { id: "m7", name: "April Newsletter", subject: "TruthStay monthly highlights", status: "sent", scheduled_at: rel(-13, 10), sent_at: rel(-13, 10), recipient_count: 2340, open_rate: 32.1, click_rate: 8.4, created_at: rel(-14), channel: "email", segment_label: "All subscribers" },
  { id: "m8", name: "Referral Drive Push", subject: "Invite friends, earn rewards", status: "sent", scheduled_at: rel(-8, 14), sent_at: rel(-8, 14), recipient_count: 890, open_rate: 19.3, click_rate: 5.2, created_at: rel(-9), channel: "push", segment_label: "Active users" },
  { id: "m9", name: "Easter Holiday Deals", subject: "Best Easter escapes — book now", status: "sent", scheduled_at: rel(-18, 9), sent_at: rel(-18, 9), recipient_count: 3100, open_rate: 41.7, click_rate: 12.8, created_at: rel(-19), channel: "both", segment_label: "All users" },
  { id: "m10", name: "April Promo — Cancelled", subject: "Limited offer", status: "cancelled", scheduled_at: rel(-3, 10), sent_at: null, recipient_count: 100, open_rate: null, click_rate: null, created_at: rel(-4), channel: "email", segment_label: "Pro subscribers" },
];

const MOCK_SOCIAL_POSTS = [
  { id: "s1", platform: "instagram", caption: "Cycling Provence 🚴", scheduled_at: rel(1, 12) },
  { id: "s2", platform: "tiktok",    caption: "Top 5 beach destinations", scheduled_at: rel(3, 19) },
  { id: "s3", platform: "twitter",   caption: "New TruthStay features!", scheduled_at: rel(1, 9) },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function channelBg(ch?: string) {
  if (ch === "email") return "bg-blue-light text-blue";
  if (ch === "push")  return "bg-lavender text-charcoal";
  if (ch === "both")  return "bg-teal-light text-teal-dark";
  return "bg-grey-100 text-grey-700";
}

function channelLabel(ch?: string) {
  if (ch === "email") return "Email";
  if (ch === "push")  return "Push";
  if (ch === "both")  return "Email + Push";
  return ch ?? "—";
}

function plannerCardBg(ch?: string) {
  if (ch === "email") return "bg-blue text-white";
  if (ch === "push")  return "bg-lavender text-charcoal border border-slate-200";
  if (ch === "both")  return "bg-teal text-white";
  return "bg-grey-200 text-dark";
}

function socialBadge(platform: string) {
  if (platform === "instagram") return { bg: "bg-rose-100 text-rose-600", label: "IG" };
  if (platform === "tiktok")    return { bg: "bg-slate-100 text-slate-700", label: "TT" };
  if (platform === "twitter")   return { bg: "bg-sky-100 text-sky-600", label: "𝕏" };
  return { bg: "bg-grey-100 text-grey-500", label: platform };
}

async function patchCampaign(id: string, changes: Record<string, unknown>) {
  await fetch(`/api/admin/marketing/campaigns/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  }).catch(() => {});
}

// ─── ScheduleDateModal ────────────────────────────────────────────────────────

function ScheduleDateModal({
  title = "Schedule Campaign",
  prefillDate,
  onClose,
  onConfirm,
}: {
  title?: string;
  prefillDate?: Date;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const [dt, setDt] = useState(() => {
    if (!prefillDate) return "";
    const d = new Date(prefillDate);
    d.setHours(9, 0, 0, 0);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-dark">{title}</h3>
          <button onClick={onClose} className="text-grey-400 hover:text-dark p-1 rounded-lg hover:bg-grey-100 transition">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-grey-500 mb-4">Pick a date and time to send this campaign.</p>
        <input
          type="datetime-local"
          value={dt}
          onChange={e => setDt(e.target.value)}
          className="w-full border border-grey-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition mb-5"
        />
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 border border-grey-300 text-sm font-medium rounded-xl px-4 py-2.5 hover:bg-grey-50 transition">
            Cancel
          </button>
          <button
            onClick={() => { if (dt) onConfirm(new Date(dt).toISOString()); }}
            disabled={!dt}
            className="flex-1 bg-teal text-white text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-teal-dark transition disabled:opacity-40">
            Approve &amp; Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KanbanCard ───────────────────────────────────────────────────────────────

function KanbanCard({ campaign }: { campaign: Campaign }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 select-none hover:shadow-md transition-shadow">
      {campaign.status === "draft" && (
        <div className="mb-2.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-dark bg-teal-light px-2 py-0.5 rounded-full">
            <Zap size={9} /> Needs approval
          </span>
        </div>
      )}

      <Link href={`/marketing/campaigns/${campaign.id}`}
        className="font-semibold text-dark text-sm leading-tight mb-2 block hover:text-teal transition-colors line-clamp-2">
        {campaign.name}
      </Link>

      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {campaign.channel && (
          <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", channelBg(campaign.channel))}>
            {channelLabel(campaign.channel)}
          </span>
        )}
        {campaign.created_by === "agent"
          ? <span title="Agent-drafted" className="w-4 h-4 rounded-full bg-teal-light flex items-center justify-center shrink-0"><Bot size={9} className="text-teal-dark" /></span>
          : <span title="Manual" className="w-4 h-4 rounded-full bg-grey-100 flex items-center justify-center shrink-0"><User size={9} className="text-grey-500" /></span>}
      </div>

      {campaign.segment_label && (
        <p className="text-[11px] text-grey-500 mb-2">
          {campaign.segment_label}
          {campaign.recipient_count != null && (
            <span className="text-grey-400"> · {campaign.recipient_count.toLocaleString()} users</span>
          )}
        </p>
      )}

      <div className="flex items-center gap-1 text-[11px] text-grey-400">
        <Calendar size={10} />
        <span>
          {campaign.sent_at
            ? formatDate(campaign.sent_at)
            : campaign.scheduled_at
            ? formatDate(campaign.scheduled_at)
            : formatDate(campaign.created_at)}
        </span>
      </div>

      {campaign.status === "sent" && campaign.open_rate != null && (
        <div className="mt-2.5 pt-2.5 border-t border-grey-100 flex gap-3 text-[11px]">
          <span>
            <span className="font-semibold text-dark">{campaign.open_rate.toFixed(1)}%</span>
            <span className="text-grey-400"> opened</span>
          </span>
          {campaign.click_rate != null && (
            <span>
              <span className="font-semibold text-dark">{campaign.click_rate.toFixed(1)}%</span>
              <span className="text-grey-400"> clicked</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── KanbanView ───────────────────────────────────────────────────────────────

function KanbanView({
  campaigns,
  onUpdate,
  setToast,
}: {
  campaigns: Campaign[];
  onUpdate: (id: string, changes: Partial<Campaign>) => void;
  setToast: (msg: string) => void;
}) {
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const pendingMove = useRef<{ id: string; toStatus: string } | null>(null);

  const grouped = Object.fromEntries(
    KANBAN_COLS.map(col => [col.id, campaigns.filter(c => c.status === col.id)])
  );

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const fromCol = result.source.droppableId;
    const toCol = result.destination.droppableId;
    if (fromCol === toCol) return;

    const campaignId = result.draggableId;

    if (toCol === "scheduled" && fromCol === "draft") {
      pendingMove.current = { id: campaignId, toStatus: "scheduled" };
      setScheduleFor(campaignId);
      return;
    }

    onUpdate(campaignId, { status: toCol as Campaign["status"] });
    setToast(`Moved to ${KANBAN_COLS.find(c => c.id === toCol)?.label ?? toCol}`);
  }

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {KANBAN_COLS.map(col => (
            <div key={col.id} className={cn("flex-shrink-0 w-[270px] rounded-2xl p-3", col.bg)}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={cn("w-2 h-2 rounded-full", col.dot)} />
                <span className={cn("text-[11px] font-bold uppercase tracking-wider", col.head)}>
                  {col.label}
                </span>
                <span className="ml-auto text-[11px] font-semibold text-grey-400 bg-white/80 rounded-full px-2 py-0.5">
                  {grouped[col.id]?.length ?? 0}
                </span>
              </div>

              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "space-y-2.5 min-h-[120px] rounded-xl transition-colors p-1 -m-1",
                      snapshot.isDraggingOver && "bg-teal-bg/60 ring-2 ring-teal ring-inset"
                    )}
                  >
                    {(grouped[col.id] ?? []).map((c, index) => (
                      <Draggable key={c.id} draggableId={c.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(snapshot.isDragging && "rotate-1 opacity-90")}
                          >
                            <KanbanCard campaign={c} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {(grouped[col.id] ?? []).length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-grey-200 text-xs text-grey-400">
                        Drop here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {scheduleFor && (
        <ScheduleDateModal
          onClose={() => { setScheduleFor(null); pendingMove.current = null; }}
          onConfirm={iso => {
            if (pendingMove.current) {
              onUpdate(pendingMove.current.id, { status: "scheduled", scheduled_at: iso });
              setToast("Campaign approved & scheduled");
            }
            setScheduleFor(null);
            pendingMove.current = null;
          }}
        />
      )}
    </>
  );
}

// ─── PlannerView ──────────────────────────────────────────────────────────────

function PlannerView({
  campaigns,
  onUpdate,
  setToast,
}: {
  campaigns: Campaign[];
  onUpdate: (id: string, changes: Partial<Campaign>) => void;
  setToast: (msg: string) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PlannerMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [trayOpen, setTrayOpen] = useState(true);
  const [plannerSchedule, setPlannerSchedule] = useState<{ campaignId: string; date: Date } | null>(null);
  const plannerDrag = useRef<{ campaignId: string } | null>(null);
  const plannerDragging = useRef(false);

  function weekOffsetForDay(day: Date): number {
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const targetWeekStart = startOfWeek(day, { weekStartsOn: 1 });
    return Math.round((targetWeekStart.getTime() - currentWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  }

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const refMonth = addMonths(new Date(), monthOffset);
  const monthStart = startOfMonth(refMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: endOfMonth(refMonth) });

  const weekLabel = `${format(weekDays[0]!, "d MMM")} – ${format(weekDays[6]!, "d MMM yyyy")}`;
  const monthLabel = format(refMonth, "MMMM yyyy");

  const unscheduled = campaigns.filter(c => c.status === "draft" && !c.scheduled_at);
  const scheduled = campaigns.filter(c => !!c.scheduled_at);

  function campaignsOnDay(day: Date) {
    return scheduled.filter(c => c.scheduled_at && isSameDay(parseISO(c.scheduled_at), day));
  }
  function socialOnDay(day: Date) {
    return MOCK_SOCIAL_POSTS.filter(p => isSameDay(parseISO(p.scheduled_at), day));
  }

  function handleDrop(day: Date) {
    const drag = plannerDrag.current;
    if (!drag) return;
    plannerDrag.current = null;
    setDragOverDay(null);
    const campaign = campaigns.find(c => c.id === drag.campaignId);
    if (!campaign) return;

    if (!campaign.scheduled_at) {
      setPlannerSchedule({ campaignId: campaign.id, date: day });
      return;
    }

    const existing = parseISO(campaign.scheduled_at);
    const newDate = new Date(day);
    newDate.setHours(existing.getHours(), existing.getMinutes());
    onUpdate(campaign.id, { scheduled_at: newDate.toISOString() });
    setToast(`Rescheduled to ${format(newDate, "EEE d MMM 'at' HH:mm")}`);
  }

  // Month grid: pad front to Monday
  const firstWeekday = monthStart.getDay(); // 0=Sun
  const frontPad = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const monthCells: (Date | null)[] = [...Array(frontPad).fill(null), ...monthDays];
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Planner toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-grey-100 gap-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => mode === "week" ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)}
              className="p-1.5 rounded-lg hover:bg-grey-100 text-grey-500 hover:text-dark transition">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-dark min-w-[200px] text-center">
              {mode === "week" ? weekLabel : monthLabel}
            </span>
            <button
              onClick={() => mode === "week" ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)}
              className="p-1.5 rounded-lg hover:bg-grey-100 text-grey-500 hover:text-dark transition">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex gap-0 border border-grey-200 rounded-lg overflow-hidden">
            {(["week", "month"] as PlannerMode[]).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={cn(
                  "px-3 py-1.5 text-xs font-semibold transition capitalize",
                  mode === m ? "bg-slate-900 text-white" : "text-grey-500 hover:text-dark hover:bg-grey-50"
                )}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* ── Week view ── */}
        {mode === "week" && (
          <div className="overflow-x-auto">
            <div className="grid" style={{ gridTemplateColumns: "repeat(7, minmax(130px, 1fr))" }}>
              {/* Headers */}
              {weekDays.map(day => (
                <div key={day.toISOString()}
                  className={cn(
                    "px-3 py-2.5 border-b border-r border-grey-100 last:border-r-0 text-center",
                    isToday(day) && "border-l-2 border-l-teal bg-teal-bg/30"
                  )}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-grey-400">{format(day, "EEE")}</p>
                  <p className={cn("text-sm font-bold", isToday(day) ? "text-teal" : "text-dark")}>{format(day, "d")}</p>
                </div>
              ))}

              {/* Day cells */}
              {weekDays.map(day => {
                const dayKey = format(day, "yyyy-MM-dd");
                const isOver = dragOverDay === dayKey;
                return (
                  <div key={dayKey}
                    className={cn(
                      "min-h-[180px] p-2 border-r border-grey-100 last:border-r-0 space-y-1 transition-colors",
                      isToday(day) && "border-l-2 border-l-teal",
                      isOver && "bg-teal-bg"
                    )}
                    onDragOver={e => { e.preventDefault(); setDragOverDay(dayKey); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null); }}
                    onDrop={e => { e.preventDefault(); handleDrop(day); }}
                  >
                    {/* Campaign cards */}
                    {campaignsOnDay(day).map(c => (
                      <div key={c.id}
                        draggable
                        onDragStart={() => { plannerDragging.current = true; plannerDrag.current = { campaignId: c.id }; }}
                        onDragEnd={() => { setTimeout(() => { plannerDragging.current = false; }, 0); }}
                        onClick={() => { if (!plannerDragging.current) router.push(`/marketing/campaigns/${c.id}`); }}
                        className={cn(
                          "rounded-lg px-2 py-1.5 text-[11px] font-medium leading-tight cursor-grab active:cursor-grabbing select-none hover:opacity-90 transition-opacity",
                          plannerCardBg(c.channel)
                        )}
                      >
                        <p className="truncate font-semibold">{c.name}</p>
                        {c.scheduled_at && (
                          <p className="opacity-70 mt-0.5 text-[10px]">{format(parseISO(c.scheduled_at), "HH:mm")}</p>
                        )}
                      </div>
                    ))}

                    {/* Social posts (read-only) */}
                    {socialOnDay(day).map(p => {
                      const { bg, label } = socialBadge(p.platform);
                      return (
                        <div key={p.id} className={cn("rounded-lg px-2 py-1 text-[10px] font-medium flex items-center gap-1", bg)}>
                          <span className="font-bold">{label}</span>
                          <span className="truncate opacity-80">{p.caption}</span>
                        </div>
                      );
                    })}

                    {isOver && (
                      <div className="h-9 rounded-lg border-2 border-dashed border-teal flex items-center justify-center text-[10px] font-semibold text-teal">
                        Drop to schedule
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Month view ── */}
        {mode === "month" && (
          <div>
            <div className="grid grid-cols-7 border-b border-grey-100">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                <div key={d} className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-grey-400 border-r border-grey-100 last:border-r-0">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map((day, i) => {
                if (!day) return <div key={i} className="min-h-[90px] border-r border-b border-grey-100 bg-grey-50/50 last:border-r-0" />;
                const cs = campaignsOnDay(day);
                const ss = socialOnDay(day);
                const dayKey = format(day, "yyyy-MM-dd");
                const isOver = dragOverDay === dayKey;
                return (
                  <div key={day.toISOString()}
                    className={cn(
                      "min-h-[90px] p-2 border-r border-b border-grey-100 last:border-r-0 transition-colors",
                      isToday(day) && "bg-teal-bg/40",
                      isOver && "bg-teal-bg ring-2 ring-inset ring-teal"
                    )}
                    onDragOver={e => { e.preventDefault(); setDragOverDay(dayKey); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null); }}
                    onDrop={e => { e.preventDefault(); handleDrop(day); }}
                  >
                    <button
                      onClick={() => { setWeekOffset(weekOffsetForDay(day)); setMode("week"); }}
                      className={cn("text-xs font-semibold mb-1.5 hover:text-teal transition-colors block", isToday(day) ? "text-teal" : "text-grey-400")}
                    >
                      {format(day, "d")}
                    </button>
                    {cs.slice(0, 2).map(c => (
                      <div key={c.id}
                        draggable
                        onDragStart={() => { plannerDragging.current = true; plannerDrag.current = { campaignId: c.id }; }}
                        onDragEnd={() => { setTimeout(() => { plannerDragging.current = false; }, 0); }}
                        onClick={e => { e.stopPropagation(); if (!plannerDragging.current) router.push(`/marketing/campaigns/${c.id}`); }}
                        className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold mb-0.5 truncate cursor-grab", channelBg(c.channel))}>
                        {c.name}
                      </div>
                    ))}
                    {cs.length > 2 && <p className="text-[9px] text-grey-400">+{cs.length - 2} more</p>}
                    {ss.map(p => {
                      const { bg, label } = socialBadge(p.platform);
                      return (
                        <div key={p.id} className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold mb-0.5 inline-block mr-0.5", bg)}>
                          {label}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Unscheduled tray ── */}
      {unscheduled.length > 0 && (
        <div className="mt-4 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setTrayOpen(o => !o)}
            className="w-full flex items-center gap-2 px-5 py-3 text-sm font-semibold text-dark hover:bg-slate-200/50 transition text-left">
            <Zap size={14} className="text-teal shrink-0" />
            Unscheduled Drafts ({unscheduled.length})
            <ChevronDown size={14} className={cn("ml-auto text-grey-400 transition-transform", trayOpen && "rotate-180")} />
          </button>
          {trayOpen && (
            <div className="px-4 pb-4 flex gap-3 flex-wrap">
              {unscheduled.map(c => (
                <div key={c.id}
                  draggable
                  onDragStart={() => { plannerDrag.current = { campaignId: c.id }; }}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 w-[200px] cursor-grab active:cursor-grabbing select-none hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {c.created_by === "agent"
                      ? <Bot size={10} className="text-teal-dark shrink-0" />
                      : <User size={10} className="text-grey-400 shrink-0" />}
                    {c.channel && (
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full", channelBg(c.channel))}>
                        {channelLabel(c.channel)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-dark leading-tight line-clamp-2 mb-1">{c.name}</p>
                  {c.recipient_count != null && (
                    <p className="text-[10px] text-grey-400 mb-1">{c.recipient_count.toLocaleString()} users</p>
                  )}
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-teal-dark bg-teal-light px-1.5 py-0.5 rounded-full">
                    <Zap size={8} /> Draft
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {plannerSchedule && (
        <ScheduleDateModal
          title="Schedule Draft"
          prefillDate={plannerSchedule.date}
          onClose={() => setPlannerSchedule(null)}
          onConfirm={iso => {
            onUpdate(plannerSchedule.campaignId, { status: "scheduled", scheduled_at: iso });
            setToast(`Approved & scheduled for ${format(new Date(iso), "EEE d MMM 'at' HH:mm")}`);
            setPlannerSchedule(null);
          }}
        />
      )}
    </>
  );
}

// ─── TableView ────────────────────────────────────────────────────────────────

function TableView({ campaigns }: { campaigns: Campaign[] }) {
  const columns: ColumnDef<Campaign, any>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <Link href={`/marketing/campaigns/${row.original.id}`}
          className="font-medium text-dark hover:text-teal transition-colors">
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "channel",
      header: "Channel",
      accessorFn: r => r.channel ?? "",
      cell: ({ getValue }) => {
        const ch = getValue<string>();
        return ch
          ? <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", channelBg(ch))}>{channelLabel(ch)}</span>
          : <span className="text-grey-400">—</span>;
      },
    },
    {
      accessorKey: "segment_label",
      header: "Segment",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{getValue<string | null>() ?? "—"}</span>,
    },
    {
      id: "recipients",
      header: "Recipients",
      accessorFn: r => r.recipient_count ?? 0,
      cell: ({ getValue }) => <span className="text-sm font-mono">{getValue<number>() > 0 ? getValue<number>().toLocaleString() : "—"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => <StatusBadge value={getValue<string>()} />,
    },
    {
      id: "open_rate",
      header: "Open rate",
      accessorFn: r => r.open_rate ?? -1,
      cell: ({ getValue }) => <span className="text-sm">{getValue<number>() >= 0 ? `${getValue<number>().toFixed(1)}%` : "—"}</span>,
    },
    {
      id: "click_rate",
      header: "Click rate",
      accessorFn: r => r.click_rate ?? -1,
      cell: ({ getValue }) => <span className="text-sm">{getValue<number>() >= 0 ? `${getValue<number>().toFixed(1)}%` : "—"}</span>,
    },
    {
      accessorKey: "scheduled_at",
      header: "Scheduled",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{getValue<string | null>() ? formatDateTime(getValue<string>()) : "—"}</span>,
    },
    {
      accessorKey: "sent_at",
      header: "Sent",
      cell: ({ getValue }) => <span className="text-xs text-grey-500">{getValue<string | null>() ? formatDateTime(getValue<string>()) : "—"}</span>,
    },
  ];
  return <DataTable data={campaigns} columns={columns} searchKey="name" searchPlaceholder="Search campaigns…" />;
}

// ─── CreateCampaignModal ──────────────────────────────────────────────────────

function CreateCampaignModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (c: Campaign) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<"email" | "push" | "both">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [segment, setSegment] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(asDraft: boolean) {
    if (!name) return;
    setSaving(true);
    try {
      const payload = {
        name, subject, body_html: body, channel,
        status: asDraft ? "draft" : "scheduled",
        segment_label: segment || null,
        scheduled_at: !asDraft && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };
      const res = await fetch("/api/admin/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onCreated({ id: `new-${Date.now()}`, sent_at: null, recipient_count: null, open_rate: null, click_rate: null, created_at: new Date().toISOString(), created_by: "manual", ...payload } as Campaign);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-grey-100 shrink-0">
          <h2 className="font-display font-semibold text-dark text-lg">Create Campaign</h2>
          <button onClick={onClose} className="text-grey-400 hover:text-dark p-1 rounded-lg hover:bg-grey-100 transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Campaign name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Summer re-engagement — France"
              className="w-full border border-grey-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition" />
          </div>

          <div>
            <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Channel</label>
            <div className="flex gap-2">
              {(["email", "push", "both"] as const).map(ch => (
                <button key={ch} onClick={() => setChannel(ch)}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-xs font-semibold border transition",
                    channel === ch ? "bg-slate-900 text-white border-slate-900" : "border-grey-300 text-grey-500 hover:border-grey-400 hover:text-dark"
                  )}>
                  {channelLabel(ch)}
                </button>
              ))}
            </div>
          </div>

          {(channel === "email" || channel === "both") && (
            <div>
              <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Subject line</label>
              <input value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Your next adventure awaits"
                className="w-full border border-grey-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition" />
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">
              {channel === "push" ? "Push message" : "Email body"}
            </label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              placeholder={channel === "push" ? "Push notification body..." : "Email body..."}
              className="w-full border border-grey-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition" />
          </div>

          <div>
            <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Audience segment</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                { label: "Activity type",   opts: ["Cycling", "Hiking", "Beach", "City break", "Skiing"] },
                { label: "Region interest", opts: ["France", "Spain", "Portugal", "Italy", "UK"] },
                { label: "Last active",     opts: ["Any time", "Last 7 days", "Last 30 days", "Inactive 30d+"] },
                { label: "Subscription",    opts: ["All", "Free", "Pro", "Premium"] },
              ].map(({ label, opts }) => (
                <select key={label}
                  className="border border-grey-300 rounded-xl px-3 py-2.5 text-sm text-grey-700 focus:outline-none focus:border-teal transition bg-white">
                  <option value="">{label}</option>
                  {opts.map(o => <option key={o}>{o}</option>)}
                </select>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-grey-500">
              <Users size={12} />
              <span>Estimated recipients: <span className="font-semibold text-dark">—</span></span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-grey-500 uppercase tracking-wide block mb-1.5">Schedule</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              className="w-full border border-grey-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/10 transition" />
            <p className="text-[11px] text-grey-400 mt-1">Leave blank to save as unscheduled draft</p>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-grey-100 shrink-0">
          <button onClick={() => submit(true)} disabled={!name || saving}
            className="flex-1 border border-grey-300 text-sm font-semibold text-dark rounded-xl px-4 py-2.5 hover:bg-grey-50 transition disabled:opacity-40">
            Save as Draft
          </button>
          <button onClick={() => submit(false)} disabled={!name || !scheduledAt || saving}
            className="flex-1 bg-teal text-white text-sm font-semibold rounded-xl px-4 py-2.5 hover:bg-teal-dark transition disabled:opacity-40">
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const VIEWS: { key: View; label: string; icon: React.ElementType }[] = [
  { key: "table",   label: "Table",   icon: List },
  { key: "kanban",  label: "Kanban",  icon: LayoutGrid },
  { key: "planner", label: "Planner", icon: Calendar },
];

export default function CampaignsPage() {
  const [view, setView] = useState<View>("kanban");
  const [campaigns, setCampaigns] = useState<Campaign[]>(MOCK_CAMPAIGNS);
  const [search, setSearch] = useState("");
  const [createModal, setCreateModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/marketing/campaigns")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setCampaigns(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = search
    ? campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : campaigns;

  async function handleUpdate(id: string, changes: Partial<Campaign>) {
    await patchCampaign(id, changes as Record<string, unknown>);
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Campaigns"
        description="Manage email and push campaigns across Kanban, calendar, and table views."
        actions={
          <button
            onClick={() => setCreateModal(true)}
            className="inline-flex items-center gap-1.5 bg-teal text-white text-sm font-semibold px-4 py-2 rounded-full hover:bg-teal-dark transition">
            <Plus size={14} /> Create Campaign
          </button>
        }
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns…"
            className="pl-8 pr-3 py-2 text-sm border border-grey-300 rounded-xl focus:outline-none focus:border-teal/60 focus:ring-2 focus:ring-teal/10 transition w-[200px]"
          />
        </div>
        <button className="flex items-center gap-1.5 border border-grey-300 text-sm text-grey-500 rounded-xl px-3 py-2 hover:border-grey-400 hover:text-dark transition">
          <Filter size={13} /> Filter
        </button>

        {/* View toggle */}
        <div className="ml-auto flex gap-0 border border-grey-200 rounded-xl overflow-hidden">
          {VIEWS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition",
                view === key ? "bg-slate-900 text-white" : "text-grey-500 hover:text-dark hover:bg-grey-50"
              )}>
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === "kanban"  && <KanbanView  campaigns={filtered} onUpdate={handleUpdate} setToast={setToast} />}
      {view === "table"   && <TableView   campaigns={filtered} />}
      {view === "planner" && <PlannerView campaigns={filtered} onUpdate={handleUpdate} setToast={setToast} />}

      {createModal && (
        <CreateCampaignModal
          onClose={() => setCreateModal(false)}
          onCreated={c => setCampaigns(prev => [c, ...prev])}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-dark text-white text-sm px-5 py-2.5 rounded-full shadow-xl z-50 pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
