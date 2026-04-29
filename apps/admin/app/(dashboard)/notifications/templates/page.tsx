"use client";
import { useEffect, useState } from "react";
import { Plus, Eye, Edit2, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/utils";

type Template = {
  id: string;
  name: string;
  title: string;
  body: string;
  channel: string;
  created_at: string;
};

type Channel = "all" | "email" | "push" | "sms" | "in_app";

const VARIABLE_EXAMPLES = ["{{user_name}}", "{{trip_name}}", "{{destination}}", "{{invite_link}}", "{{promo_code}}", "{{review_link}}"];

function TemplateCard({ t, onPreview }: { t: Template; onPreview: (t: Template) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-dark text-sm">{t.name}</p>
          <p className="text-xs text-grey-500 mt-0.5 truncate">{t.title}</p>
        </div>
        <StatusBadge value={t.channel} />
      </div>
      <p className="text-xs text-grey-700 line-clamp-3 leading-relaxed">{t.body}</p>
      <div className="flex items-center gap-2 pt-1 border-t border-grey-50">
        <button onClick={() => onPreview(t)}
          className="flex items-center gap-1.5 text-xs text-grey-500 hover:text-dark px-2 py-1 rounded-lg hover:bg-grey-100 transition">
          <Eye size={12} /> Preview
        </button>
        <button className="flex items-center gap-1.5 text-xs text-grey-500 hover:text-dark px-2 py-1 rounded-lg hover:bg-grey-100 transition">
          <Edit2 size={12} /> Edit
        </button>
        <button className="ml-auto flex items-center gap-1.5 text-xs text-blue border border-blue/30 hover:bg-blue-light px-2 py-1 rounded-lg transition">
          <Send size={12} /> Test send
        </button>
        <span className="text-[10px] text-grey-400">{formatDate(t.created_at)}</span>
      </div>
    </div>
  );
}

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading]     = useState(true);
  const [channel, setChannel]     = useState<Channel>("all");
  const [preview, setPreview]     = useState<Template | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ name: "", title: "", body: "", channel: "email" });

  useEffect(() => {
    fetch("/api/admin/notifications/templates")
      .then(r => r.json())
      .then(d => { setTemplates(Array.isArray(d) ? d : []); setLoading(false); });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/notifications/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setTemplates(prev => [data, ...prev]);
    }
    setShowForm(false);
    setForm({ name: "", title: "", body: "", channel: "email" });
  }

  const CHANNELS: Channel[] = ["all", "email", "push", "sms", "in_app"];
  const filtered = channel === "all" ? templates : templates.filter(t => t.channel === channel);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Templates"
        description="Manage reusable templates with variable placeholders."
        actions={
          <button onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-1.5 bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">
            <Plus size={14} /> New template
          </button>
        }
      />

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-grey-300 rounded-xl p-5 space-y-4">
          <h3 className="font-display font-semibold text-dark text-sm">Create template</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Name *</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Welcome email"
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-grey-700 mb-1">Channel *</label>
              <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue/60">
                {["email", "push", "sms", "in_app"].map(c => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-grey-700 mb-1">Subject / Title *</label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Welcome to TruthStay, {{user_name}}!"
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue/60" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-grey-700 mb-1">Body *</label>
              <textarea required rows={4} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Use {{variable_name}} for dynamic content…"
                className="w-full border border-grey-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue/60" />
              <p className="text-[10px] text-grey-400 mt-1">Available variables:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {VARIABLE_EXAMPLES.map(v => (
                  <code key={v} className="text-[10px] bg-grey-50 border border-grey-200 px-1.5 py-0.5 rounded text-grey-700">{v}</code>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-blue text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-dark transition">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-grey-700 px-4 py-2 hover:text-dark">Cancel</button>
          </div>
        </form>
      )}

      {/* Channel filter */}
      <div className="flex gap-1 border-b border-grey-300">
        {CHANNELS.map(c => (
          <button key={c} onClick={() => setChannel(c)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px capitalize ${
              channel === c ? "border-blue text-blue" : "border-transparent text-grey-700 hover:text-dark"
            }`}>
            {c.replace("_", " ")}
            {c !== "all" && (
              <span className="ml-1.5 text-[10px] text-grey-400">({templates.filter(t => t.channel === c).length})</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-grey-500 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-grey-500 text-sm">No templates for this channel yet.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => <TemplateCard key={t.id} t={t} onPreview={setPreview} />)}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-grey-400 mb-0.5">{preview.channel.replace("_", " ").toUpperCase()}</p>
                <p className="font-semibold text-dark">{preview.name}</p>
              </div>
              <button onClick={() => setPreview(null)} className="text-grey-400 hover:text-dark text-lg leading-none">×</button>
            </div>
            <div className="border border-grey-200 rounded-xl p-4 bg-grey-50">
              <p className="font-semibold text-dark text-sm mb-2">{preview.title}</p>
              <p className="text-sm text-grey-700 leading-relaxed whitespace-pre-wrap">{preview.body}</p>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-blue text-white text-sm font-semibold py-2 rounded-lg hover:bg-blue-dark transition">
                Test send
              </button>
              <button onClick={() => setPreview(null)} className="flex-1 border border-grey-300 text-grey-700 text-sm py-2 rounded-lg hover:bg-grey-100 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
