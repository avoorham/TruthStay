"use client";
import { useEffect, useState } from "react";
import { Send, Users, Clock } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

type Template = {
  id: string;
  name: string;
  title: string;
  body: string;
  channel: string;
};

const AUDIENCE_SEGMENTS = [
  { id: "all",           label: "All users",               count: "3,720" },
  { id: "active_7d",    label: "Active in last 7 days",    count: "1,204" },
  { id: "inactive_21d", label: "Inactive 21+ days",        count: "847" },
  { id: "no_trip",      label: "Signed up, no trip yet",   count: "1,062" },
  { id: "has_trip",     label: "Has planned a trip",       count: "2,658" },
  { id: "subscribers",  label: "Paid subscribers",         count: "183" },
  { id: "trial",        label: "Free trial users",         count: "412" },
];

type Mode = "template" | "custom";

export default function NotificationSendPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [mode, setMode]           = useState<Mode>("template");
  const [channel, setChannel]     = useState("push");
  const [templateId, setTemplateId]   = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody]   = useState("");
  const [segment, setSegment]         = useState("all");
  const [schedule, setSchedule]       = useState<"now" | "later">("now");
  const [sendAt, setSendAt]           = useState("");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);

  useEffect(() => {
    fetch("/api/admin/notifications/templates")
      .then(r => r.json())
      .then(d => setTemplates(Array.isArray(d) ? d : []));
  }, []);

  const selectedTemplate = templates.find(t => t.id === templateId);
  const selectedSegment  = AUDIENCE_SEGMENTS.find(s => s.id === segment);

  const previewTitle = mode === "template" ? selectedTemplate?.title : customTitle;
  const previewBody  = mode === "template" ? selectedTemplate?.body  : customBody;

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    await fetch("/api/admin/notifications/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        template_id: mode === "template" ? templateId : undefined,
        title: customTitle,
        body: customBody,
        segment,
        scheduled_at: schedule === "later" ? sendAt : undefined,
      }),
    }).catch(() => {});
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="space-y-6">
        <PageHeader title="Send Notification" description="Broadcast messages to user segments." />
        <div className="border border-slate-200 rounded-lg p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mx-auto mb-4">
            <Send size={24} className="text-green-dark" />
          </div>
          <h2 className="text-xl font-bold text-dark mb-2">
            {schedule === "now" ? "Notification sent!" : "Notification scheduled!"}
          </h2>
          <p className="text-sm text-grey-500 mb-6">
            {schedule === "now"
              ? `Sent to ${selectedSegment?.count ?? "—"} recipients.`
              : `Scheduled for ${sendAt} to ${selectedSegment?.count ?? "—"} recipients.`}
          </p>
          <button onClick={() => setSent(false)}
            className="bg-teal-500 text-white text-sm font-medium px-6 py-2.5 rounded-md hover:bg-teal-600 transition">
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Send Notification" description="Broadcast messages to user segments via email, push, SMS, or in-app." />

      <form onSubmit={handleSend} className="grid grid-cols-3 gap-6">
        {/* Left: configuration */}
        <div className="col-span-2 space-y-5">
          {/* Channel */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-dark">Channel</h3>
            <div className="grid grid-cols-4 gap-2">
              {["email", "push", "sms", "in_app"].map(c => (
                <button key={c} type="button" onClick={() => setChannel(c)}
                  className={`py-2.5 rounded-md text-sm font-medium border transition capitalize ${
                    channel === c
                      ? "border-teal-400 bg-teal-50 text-teal-700"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}>
                  {c.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Content mode */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-4">
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
              {(["template", "custom"] as Mode[]).map(m => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${
                    mode === m ? "bg-white text-slate-900 border border-slate-200" : "text-grey-500 hover:text-dark"
                  }`}>
                  {m === "template" ? "Use template" : "Custom message"}
                </button>
              ))}
            </div>

            {mode === "template" ? (
              <div>
                <label className="block text-xs font-semibold text-grey-700 mb-1">Template *</label>
                <select required value={templateId} onChange={e => setTemplateId(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-sm bg-white focus:outline-none ">
                  <option value="">Select a template…</option>
                  {templates.filter(t => channel === "all" || t.channel === channel).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-grey-700 mb-1">Title / Subject *</label>
                  <input required value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                    placeholder="Enter notification title…"
                    className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-sm focus:outline-none " />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-grey-700 mb-1">Message *</label>
                  <textarea required rows={4} value={customBody} onChange={e => setCustomBody(e.target.value)}
                    placeholder="Enter notification body…"
                    className="w-full border border-slate-200 rounded-md px-3 py-2.5 text-sm resize-none focus:outline-none " />
                </div>
              </div>
            )}
          </div>

          {/* Audience */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-dark flex items-center gap-2"><Users size={14} /> Audience</h3>
            <div className="space-y-2">
              {AUDIENCE_SEGMENTS.map(s => (
                <label key={s.id} className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition ${
                  segment === s.id ? "border-blue bg-blue-light" : "border-slate-200 hover:bg-slate-50"
                }`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name="segment" value={s.id} checked={segment === s.id}
                      onChange={() => setSegment(s.id)} className="accent-blue" />
                    <span className="text-sm font-medium text-dark">{s.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-grey-500">{s.count} users</span>
                </label>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div className="border border-slate-200 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-dark flex items-center gap-2"><Clock size={14} /> Schedule</h3>
            <div className="flex gap-3">
              {(["now", "later"] as const).map(s => (
                <label key={s} className={`flex-1 flex items-center gap-2 p-3 rounded-md border cursor-pointer transition ${
                  schedule === s ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:bg-slate-50"
                }`}>
                  <input type="radio" name="schedule" value={s} checked={schedule === s}
                    onChange={() => setSchedule(s)} className="accent-blue" />
                  <span className="text-sm font-medium text-dark capitalize">{s === "now" ? "Send now" : "Schedule"}</span>
                </label>
              ))}
            </div>
            {schedule === "later" && (
              <div>
                <label className="block text-xs font-semibold text-grey-700 mb-1">Send at</label>
                <input type="datetime-local" required={schedule === "later"} value={sendAt}
                  onChange={e => setSendAt(e.target.value)}
                  className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none " />
              </div>
            )}
          </div>

          <button type="submit" disabled={sending}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 text-white font-medium py-3 rounded-md hover:bg-teal-600 transition disabled:opacity-60">
            <Send size={16} />
            {sending ? "Sending…" : schedule === "now" ? `Send to ${selectedSegment?.count ?? "—"} users` : "Schedule notification"}
          </button>
        </div>

        {/* Right: preview */}
        <div className="col-span-1">
          <div className="border border-slate-200 rounded-lg p-5 sticky top-6">
            <h3 className="text-sm font-semibold text-grey-500 uppercase tracking-widest mb-4">Preview</h3>
            <div className="bg-slate-50 rounded-md p-4 min-h-[160px] space-y-2">
              {previewTitle ? (
                <>
                  <p className="text-xs font-semibold text-grey-400 uppercase">{channel.replace("_", " ")}</p>
                  <p className="text-sm font-semibold text-dark">{previewTitle}</p>
                  <p className="text-xs text-grey-700 leading-relaxed">{previewBody}</p>
                </>
              ) : (
                <p className="text-xs text-grey-400 italic">Select a template or write a custom message to preview here.</p>
              )}
            </div>
            {selectedSegment && (
              <div className="mt-4 pt-4 border-t border-grey-100">
                <p className="text-xs text-grey-500 mb-1">Recipients</p>
                <p className="text-2xl font-bold text-dark">{selectedSegment.count}</p>
                <p className="text-xs text-grey-400">{selectedSegment.label}</p>
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
