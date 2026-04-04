"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { BUSINESS_MODELS, type OperationalCost } from "@/lib/finance/business-models";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Metrics {
  users:      { total: number };
  adventures: { total: number; thisMonth: number; public: number; saved: number };
  feedback:   { total: number };
  costs: {
    items:              OperationalCost[];
    monthlyFixedEUR:    number;
    monthlyAtScaleEUR:  number;
    breakEvenCurrent:   number;
    breakEvenScale:     number;
  };
  revenue: { mrrEUR: number; arrEUR: number; proSubscribers: number };
}

// ─── UI metadata per model ────────────────────────────────────────────────────

const MODEL_META: Record<string, { label: string; feasibilityColor: string; phaseBg: string; phaseLabel: string; price: string }> = {
  model_a: {
    label: "Model A",
    feasibilityColor: "text-green-600 bg-green-50",
    phaseBg: "bg-blue-50 text-blue-700",
    phaseLabel: "Launch at 500 users",
    price: "€4.99/mo or €44.99/yr",
  },
  model_b: {
    label: "Model B",
    feasibilityColor: "text-yellow-700 bg-yellow-50",
    phaseBg: "bg-green-50 text-green-700",
    phaseLabel: "Enable immediately",
    price: "Passive — no charge to users",
  },
  model_c: {
    label: "Model C",
    feasibilityColor: "text-yellow-700 bg-yellow-50",
    phaseBg: "bg-purple-50 text-purple-700",
    phaseLabel: "Launch at 5,000 users",
    price: "€25–79/mo per property",
  },
  model_d_combined: {
    label: "Roadmap",
    feasibilityColor: "text-green-600 bg-green-50",
    phaseBg: "bg-orange-50 text-orange-700",
    phaseLabel: "Recommended path",
    price: "All 3 streams combined",
  },
};

const QUICK_PROMPTS = [
  "Show me Year 2 revenue projections for the recommended combined strategy",
  "Which model should I launch first and why?",
  "What's my break-even point for running paid Meta ads?",
  "Compare gross margins across all three models in a table",
  "What marketing should I do this month with €0 budget?",
  "If I charge €9.99/month instead of €4.99, how does that change Year 3 ARR?",
];

// ─── Markdown-like renderer ───────────────────────────────────────────────────

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function renderText(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-bold text-[#212121] mt-4 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold text-[#212121] mt-5 mb-2">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold text-[#212121] mt-5 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("|")) {
        const l = lines[i] ?? "";
        if (!l.match(/^\|[-| ]+\|$/)) tableLines.push(l);
        i++;
      }
      elements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-3">
          <table className="text-sm border-collapse w-full">
            {tableLines.map((row, ri) => {
              const cells = row.split("|").filter((_, ci) => ci > 0 && ci < row.split("|").length - 1).map((c) => c.trim());
              const isHeader = ri === 0;
              return (
                <tr key={ri} className={isHeader ? "bg-[#f5f5f5]" : "border-b border-[#e8e8e8]"}>
                  {cells.map((cell, ci) =>
                    isHeader ? (
                      <th key={ci} className="text-left px-3 py-2 font-semibold text-[#212121] border border-[#e8e8e8]">{inlineFormat(cell)}</th>
                    ) : (
                      <td key={ci} className="px-3 py-2 text-[#444] border border-[#e8e8e8]">{inlineFormat(cell)}</td>
                    )
                  )}
                </tr>
              );
            })}
          </table>
        </div>
      );
      continue;
    } else if (line.match(/^[-*] /)) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i] ?? "").match(/^[-*] /)) { listItems.push((lines[i] ?? "").slice(2)); i++; }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc list-inside space-y-1 my-2 text-sm text-[#444]">
          {listItems.map((item, li) => <li key={li}>{inlineFormat(item)}</li>)}
        </ul>
      );
      continue;
    } else if (line.match(/^\d+\. /)) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i] ?? "").match(/^\d+\. /)) { listItems.push((lines[i] ?? "").replace(/^\d+\. /, "")); i++; }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal list-inside space-y-1 my-2 text-sm text-[#444]">
          {listItems.map((item, li) => <li key={li}>{inlineFormat(item)}</li>)}
        </ol>
      );
      continue;
    } else if (line.match(/^---+$/)) {
      elements.push(<hr key={i} className="my-4 border-[#e8e8e8]" />);
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(<p key={i} className="text-sm text-[#444] leading-relaxed">{inlineFormat(line)}</p>);
    }

    i++;
  }

  return elements;
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#e8e8e8] p-4">
      <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#212121]">{value}</p>
      {sub && <p className="text-xs text-[#717182] mt-0.5">{sub}</p>}
    </div>
  );
}

function DashboardTab({ onAsk }: { onAsk: (q: string) => void }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/finance/metrics")
      .then((r) => r.json() as Promise<Metrics>)
      .then(setMetrics)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-[#bbb] rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 bg-[#bbb] rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 bg-[#bbb] rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    );
  }

  if (!metrics) return <p className="text-sm text-[#717182]">Failed to load metrics.</p>;

  const { users, adventures, feedback, costs, revenue } = metrics;

  return (
    <div className="space-y-6">
      {/* Live metrics */}
      <div>
        <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-3">Live Metrics</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total Users"       value={users.total} />
          <MetricCard label="Adventures"        value={adventures.total} sub={`${adventures.thisMonth} this month`} />
          <MetricCard label="Public Adventures" value={adventures.public} />
          <MetricCard label="Saved Adventures"  value={adventures.saved} />
          <MetricCard label="Feedback Ratings"  value={feedback.total} />
          <MetricCard label="MRR"               value={`€${revenue.mrrEUR}`} sub={`${revenue.proSubscribers} Pro subscribers`} />
        </div>
      </div>

      {/* Revenue vs costs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-4">
          <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-1">Monthly Revenue</p>
          <p className="text-2xl font-bold text-[#212121]">€{revenue.mrrEUR.toFixed(2)}</p>
          <p className="text-xs text-[#717182] mt-0.5">€{revenue.arrEUR.toFixed(0)} ARR</p>
        </div>
        <div className="bg-white rounded-xl border border-[#e8e8e8] p-4">
          <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-1">Monthly Fixed Costs</p>
          <p className="text-2xl font-bold text-[#212121]">€{costs.monthlyFixedEUR.toFixed(2)}</p>
          <p className="text-xs text-[#717182] mt-0.5">€{costs.monthlyAtScaleEUR.toFixed(2)} at scale</p>
        </div>
        <div className={`rounded-xl border p-4 ${revenue.mrrEUR >= costs.monthlyFixedEUR ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-1">Monthly Burn</p>
          <p className={`text-2xl font-bold ${revenue.mrrEUR >= costs.monthlyFixedEUR ? "text-green-700" : "text-red-700"}`}>
            €{(revenue.mrrEUR - costs.monthlyFixedEUR).toFixed(2)}
          </p>
          <p className="text-xs text-[#717182] mt-0.5">
            {revenue.mrrEUR >= costs.monthlyFixedEUR ? "Profitable" : `Need ${costs.breakEvenCurrent} Pro subscribers to break even`}
          </p>
        </div>
      </div>

      {/* Cost breakdown table */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e8e8e8]">
          <p className="text-sm font-bold text-[#212121]">Full Cost Breakdown</p>
          <p className="text-xs text-[#717182] mt-0.5">All services · current and scale-up costs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#f5f5f5] border-b border-[#e8e8e8]">
                <th className="text-left px-4 py-2.5 font-semibold text-[#212121]">Service</th>
                <th className="text-right px-4 py-2.5 font-semibold text-[#212121]">Now</th>
                <th className="text-right px-4 py-2.5 font-semibold text-[#212121]">At Scale</th>
                <th className="text-left px-4 py-2.5 font-semibold text-[#212121] hidden sm:table-cell">Upgrades when</th>
              </tr>
            </thead>
            <tbody>
              {costs.items.map((item, i) => (
                <tr key={i} className="border-b border-[#f0f0f0] hover:bg-[#fafafa]">
                  <td className="px-4 py-2.5 text-[#212121] font-medium">{item.service}</td>
                  <td className="px-4 py-2.5 text-right text-[#212121]">
                    {item.monthlyEUR > 0 ? `€${item.monthlyEUR.toFixed(2)}` : <span className="text-green-600 font-medium">Free</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#444]">
                    {item.upgradeCostMonthlyEUR != null
                      ? `€${item.upgradeCostMonthlyEUR}/mo`
                      : item.monthlyEUR > 0 ? `€${item.monthlyEUR.toFixed(2)}` : <span className="text-green-600">Free</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[#717182] hidden sm:table-cell">
                    {item.upgradeAt ?? "—"}
                  </td>
                </tr>
              ))}
              <tr className="bg-[#f5f5f5] font-semibold">
                <td className="px-4 py-2.5 text-[#212121]">Total</td>
                <td className="px-4 py-2.5 text-right text-[#212121]">€{costs.monthlyFixedEUR.toFixed(2)}/mo</td>
                <td className="px-4 py-2.5 text-right text-[#212121]">€{costs.monthlyAtScaleEUR.toFixed(2)}/mo</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Break-even */}
      <div className="bg-white rounded-xl border border-[#e8e8e8] p-4 space-y-3">
        <p className="text-sm font-bold text-[#212121]">Break-Even Analysis (Pro at €4.99/mo, €4.14 margin)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-600 font-semibold mb-1">Current costs (€{costs.monthlyFixedEUR.toFixed(2)}/mo)</p>
            <p className="text-2xl font-bold text-blue-700">{costs.breakEvenCurrent}</p>
            <p className="text-xs text-blue-600">Pro subscribers needed</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <p className="text-xs text-orange-600 font-semibold mb-1">At scale (€{costs.monthlyAtScaleEUR.toFixed(2)}/mo)</p>
            <p className="text-2xl font-bold text-orange-700">{costs.breakEvenScale}</p>
            <p className="text-xs text-orange-600">Pro subscribers needed</p>
          </div>
        </div>
        <button
          onClick={() => onAsk("Walk me through exactly how to reach break-even as fast as possible, with a step-by-step action plan")}
          className="w-full text-xs bg-[#212121] text-white rounded-lg px-3 py-2 hover:bg-[#333] transition-colors"
        >
          Ask advisor: fastest path to break-even
        </button>
      </div>
    </div>
  );
}

// ─── Model card ───────────────────────────────────────────────────────────────

function ModelCard({ model, onAsk }: { model: (typeof BUSINESS_MODELS)[0]; onAsk: (q: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = MODEL_META[model.id];
  if (!meta) return null;

  return (
    <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-0.5">{meta.label}</div>
            <div className="text-sm font-bold text-[#212121]">{model.name}</div>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.feasibilityColor}`}>{model.feasibility}</span>
        </div>

        <p className="text-xs text-[#717182] leading-relaxed">{model.description}</p>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[#717182]">Pricing</span>
            <span className="font-medium text-[#212121]">{meta.price}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#717182]">Gross margin</span>
            <span className="font-medium text-[#212121]">{model.gross_margin_pct}%</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${meta.phaseBg}`}>{meta.phaseLabel}</span>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-[#717182] hover:text-[#212121] transition-colors"
          >
            {expanded ? "Hide ▲" : "Show calculations ▼"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#e8e8e8] bg-[#fafafa] p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-2">Unit Economics</p>
            <ul className="space-y-1">
              {model.unit_economics.map((line, i) => (
                <li key={i} className="text-xs text-[#444] flex gap-1.5">
                  <span className="text-[#bbb] shrink-0">›</span>{line}
                </li>
              ))}
            </ul>
          </div>

          {model.projections && model.projections.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-2">Revenue Projections</p>
              <div className="overflow-x-auto">
                <table className="text-xs w-full border-collapse">
                  <thead>
                    <tr className="bg-[#f0f0f0]">
                      <th className="text-left px-2 py-1.5 font-semibold text-[#212121] border border-[#e0e0e0]">Year</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-[#212121] border border-[#e0e0e0]">MAU</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-[#212121] border border-[#e0e0e0]">Paying</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-[#212121] border border-[#e0e0e0]">MRR</th>
                      <th className="text-right px-2 py-1.5 font-semibold text-[#212121] border border-[#e0e0e0]">ARR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {model.projections.map((p) => (
                      <tr key={p.year} className="border-b border-[#e0e0e0]">
                        <td className="px-2 py-1.5 text-[#444] border border-[#e0e0e0]">Y{p.year}</td>
                        <td className="px-2 py-1.5 text-right text-[#444] border border-[#e0e0e0]">{p.mau.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right text-[#444] border border-[#e0e0e0]">{p.paying_users.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right font-medium text-[#212121] border border-[#e0e0e0]">€{p.mrr_eur.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right font-medium text-[#212121] border border-[#e0e0e0]">€{p.arr_eur.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {model.tiers && model.tiers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-2">Pricing Tiers</p>
              <div className="space-y-2">
                {model.tiers.map((tier) => (
                  <div key={tier.name} className="bg-white border border-[#e8e8e8] rounded-lg p-2.5">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-semibold text-[#212121]">{tier.name}</span>
                      <span className="text-xs text-[#717182]">
                        {tier.price_monthly_eur === 0 ? "Free" : `€${tier.price_monthly_eur}/mo · €${tier.price_annual_eur}/yr`}
                      </span>
                    </div>
                    <ul className="space-y-0.5">
                      {tier.features.map((f, fi) => <li key={fi} className="text-xs text-[#717182]">· {f}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-2">Risks</p>
            <ul className="space-y-1">
              {model.risks.map((r, i) => (
                <li key={i} className="text-xs text-[#c0392b] flex gap-1.5">
                  <span className="shrink-0">!</span>{r}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => onAsk(`Explain step by step how you calculated the projections and unit economics for "${model.name}"`)}
            className="w-full text-xs bg-[#212121] text-white rounded-lg px-3 py-2 hover:bg-[#333] transition-colors"
          >
            Ask advisor to walk through the full calculation
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const [tab, setTab]           = useState<"dashboard" | "models" | "advisor">("dashboard");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    const newMessages: Message[] = [...messages, { role: "user", content: content.trim() }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setTab("advisor");

    try {
      const res = await fetch("/api/finance/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });
      const data = (await res.json()) as { text?: string };
      if (data.text) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text! }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  return (
    <div className="min-h-screen bg-[#f9f9f9]">
      {/* Header */}
      <div className="bg-white border-b border-[#e8e8e8] px-6 py-4">
        <h1 className="text-xl font-bold text-[#212121]">Finance & Strategy</h1>
        <p className="text-sm text-[#717182] mt-0.5">Live metrics · cost breakdown · AI advisor</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-[#e8e8e8] px-6">
        <div className="flex gap-0 max-w-5xl mx-auto">
          {(["dashboard", "models", "advisor"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-[#212121] text-[#212121]"
                  : "border-transparent text-[#717182] hover:text-[#212121]"
              }`}
            >
              {t === "advisor" ? "AI Advisor" : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Dashboard tab */}
        {tab === "dashboard" && <DashboardTab onAsk={sendMessage} />}

        {/* Models tab */}
        {tab === "models" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {BUSINESS_MODELS.map((model) => (
                <ModelCard key={model.id} model={model} onAsk={sendMessage} />
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-3">Ask the advisor</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void sendMessage(prompt)}
                    className="text-xs bg-white border border-[#e8e8e8] hover:border-[#212121] text-[#444] hover:text-[#212121] rounded-full px-3 py-1.5 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Advisor tab */}
        {tab === "advisor" && (
          <>
            {messages.length === 0 && (
              <div>
                <p className="text-xs font-semibold text-[#717182] uppercase tracking-wide mb-3">Quick prompts</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => void sendMessage(prompt)}
                      className="text-xs bg-white border border-[#e8e8e8] hover:border-[#212121] text-[#444] hover:text-[#212121] rounded-full px-3 py-1.5 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.length > 0 && (
              <div className="space-y-4">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "user" ? (
                      <div className="bg-[#212121] text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%]">
                        {msg.content}
                      </div>
                    ) : (
                      <div className="bg-white border border-[#e8e8e8] rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] w-full">
                        <div className="text-xs font-semibold text-[#717182] mb-2 uppercase tracking-wide">Finance Advisor</div>
                        <div>{renderText(msg.content)}</div>
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-[#e8e8e8] rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1 items-center h-5">
                        <span className="w-1.5 h-1.5 bg-[#bbb] rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1.5 h-1.5 bg-[#bbb] rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1.5 h-1.5 bg-[#bbb] rounded-full animate-bounce [animation-delay:300ms]" />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {messages.length > 0 && !loading && (
              <div className="flex flex-wrap gap-2 pt-2">
                {QUICK_PROMPTS.slice(0, 3).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => void sendMessage(prompt)}
                    className="text-xs bg-white border border-[#e8e8e8] hover:border-[#212121] text-[#717182] hover:text-[#212121] rounded-full px-3 py-1.5 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Sticky input (always visible on advisor tab) */}
        {tab === "advisor" && (
          <div className="bg-white border border-[#e8e8e8] rounded-2xl flex items-end gap-3 px-4 py-3 sticky bottom-4 shadow-sm">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
              }}
              placeholder="Ask about pricing, projections, marketing..."
              rows={1}
              className="flex-1 resize-none text-sm text-[#212121] placeholder-[#bbb] outline-none bg-transparent leading-relaxed"
              style={{ maxHeight: "120px" }}
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={!input.trim() || loading}
              className="shrink-0 bg-[#212121] disabled:bg-[#e8e8e8] text-white disabled:text-[#bbb] rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
