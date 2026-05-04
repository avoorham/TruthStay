"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2, Info } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CFOSettings {
  monthlyBurnBudget:       number;
  maxCostToRevenueRatio:   number;
  reservePercentage:       number;
  autoApproveThreshold:    number;
  weeklyScenarioAutoApply: "optimistic" | "base" | "conservative";
  planApprovalDeadline:    number;
  scenarioGenerationDay:   number;
  forecastHorizon:         number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-8 py-5 border-b border-grey-50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-dark">{label}</p>
        {hint && <p className="text-xs text-grey-400 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="shrink-0 w-[280px]">
        {children}
      </div>
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-grey-400">{format(min)}</span>
        <span className="text-sm font-semibold font-mono text-dark">{format(value)}</span>
        <span className="text-xs text-grey-400">{format(max)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-grey-200 accent-teal cursor-pointer"
        style={{
          background: `linear-gradient(to right, #2DD4BF 0%, #2DD4BF ${pct}%, #E2E8F0 ${pct}%, #E2E8F0 100%)`,
        }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);
const DAYS_OF_WEEK  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function CFOSettingsPage() {
  const [settings, setSettings] = useState<CFOSettings>({
    monthlyBurnBudget:       465,
    maxCostToRevenueRatio:   80,
    reservePercentage:       20,
    autoApproveThreshold:    1.00,
    weeklyScenarioAutoApply: "base",
    planApprovalDeadline:    3,
    scenarioGenerationDay:   0,
    forecastHorizon:         3,
  });

  const [saved,   setSaved]   = useState(false);
  const [saving,  setSaving]  = useState(false);

  function update<K extends keyof CFOSettings>(key: K, value: CFOSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
  }

  return (
    <div>
      <PageHeader
        title="CFO Settings"
        description="Configure the CFO Agent's financial governance parameters. Changes take effect on the next agent run."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/agents/cfo"
              className="flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft size={14} /> Back to CFO
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-md bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors disabled:opacity-60"
            >
              {saved
                ? <><CheckCircle2 size={15} /> Saved</>
                : saving
                ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                : <><Save size={15} /> Save changes</>
              }
            </button>
          </div>
        }
      />

      {/* ── Info banner ── */}
      <div className="border-l-4 border-blue bg-blue-light rounded-r-xl p-4 flex items-start gap-3 mb-8">
        <Info size={16} className="text-blue shrink-0 mt-0.5" />
        <p className="text-xs text-grey-700">
          These parameters are persisted in the <code className="bg-white/60 px-1 py-0.5 rounded text-[11px] font-mono">platform_config</code> table.
          The CFO Agent reads them at the start of each run cycle.
        </p>
      </div>

      {/* ── Settings sections ── */}
      <div className="space-y-8">

        {/* Budget controls */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-grey-100 bg-grey-50">
            <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest">Budget controls</p>
          </div>
          <div className="px-6">
            <SettingRow
              label="Monthly burn budget (pre-revenue)"
              hint="Maximum total spend across all agents per calendar month. The CFO will not authorise spend that would breach this ceiling."
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-grey-500">$</span>
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={settings.monthlyBurnBudget}
                  onChange={e => update("monthlyBurnBudget", Number(e.target.value))}
                  className="flex-1 text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-slate-400"
                />
                <span className="text-xs text-grey-400 whitespace-nowrap">/ month</span>
              </div>
            </SettingRow>

            <SettingRow
              label="Max cost-to-revenue ratio"
              hint="Once live revenue appears, the CFO will not allow total costs to exceed this percentage of monthly revenue."
            >
              <Slider
                value={settings.maxCostToRevenueRatio}
                min={0} max={100} step={5}
                format={v => `${v}%`}
                onChange={v => update("maxCostToRevenueRatio", v)}
              />
            </SettingRow>

            <SettingRow
              label="Reserve percentage"
              hint="Percentage of the monthly budget held back as a reserve buffer. The CFO will not allocate this portion to any agent."
            >
              <Slider
                value={settings.reservePercentage}
                min={0} max={50} step={5}
                format={v => `${v}%`}
                onChange={v => update("reservePercentage", v)}
              />
            </SettingRow>

            <SettingRow
              label="Auto-approve threshold"
              hint="Spend requests below this amount are automatically approved without requiring manual confirmation."
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-grey-500">$</span>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="50"
                  value={settings.autoApproveThreshold}
                  onChange={e => update("autoApproveThreshold", Number(e.target.value))}
                  className="flex-1 text-sm font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 focus:outline-none focus:border-slate-400"
                />
              </div>
              <p className="text-xs text-grey-400 mt-1.5">
                Currently: any request under <strong className="text-dark">${settings.autoApproveThreshold.toFixed(2)}</strong> auto-approves
              </p>
            </SettingRow>
          </div>
        </div>

        {/* Scenario controls */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-grey-100 bg-grey-50">
            <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest">Weekly scenarios</p>
          </div>
          <div className="px-6">
            <SettingRow
              label="Weekly scenario auto-apply"
              hint="Which scenario the CFO automatically activates when generating a new week. Optimistic pushes higher spend; Conservative restricts all agents."
            >
              <select
                value={settings.weeklyScenarioAutoApply}
                onChange={e => update("weeklyScenarioAutoApply", e.target.value as CFOSettings["weeklyScenarioAutoApply"])}
                className="w-full text-sm text-dark border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-slate-400"
              >
                <option value="optimistic">🟢 Optimistic</option>
                <option value="base">🟡 Base (recommended)</option>
                <option value="conservative">🔴 Conservative</option>
              </select>
            </SettingRow>

            <SettingRow
              label="Scenario generation day"
              hint="Day of the week the CFO Agent generates next week's scenarios for review."
            >
              <select
                value={settings.scenarioGenerationDay}
                onChange={e => update("scenarioGenerationDay", Number(e.target.value))}
                className="w-full text-sm text-dark border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-slate-400"
              >
                {DAYS_OF_WEEK.map((day, i) => (
                  <option key={day} value={i}>{day}{i === 0 ? " (default)" : ""}</option>
                ))}
              </select>
            </SettingRow>
          </div>
        </div>

        {/* Plan & forecast controls */}
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-grey-100 bg-grey-50">
            <p className="text-xs font-semibold text-grey-500 uppercase tracking-widest">Monthly plan &amp; forecasts</p>
          </div>
          <div className="px-6">
            <SettingRow
              label="Plan approval deadline"
              hint="Day of the month by which the monthly plan must be approved. The CFO will send a reminder if the plan is still pending after this date."
            >
              <select
                value={settings.planApprovalDeadline}
                onChange={e => update("planApprovalDeadline", Number(e.target.value))}
                className="w-full text-sm text-dark border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-slate-400"
              >
                {DAYS_OF_MONTH.slice(0, 15).map(d => (
                  <option key={d} value={d}>{d}{d === 3 ? " (default)" : ""}  of the month</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow
              label="Forecast horizon"
              hint="Number of months the CFO projects revenue and cost forecasts. Longer horizons use more linear extrapolation."
            >
              <select
                value={settings.forecastHorizon}
                onChange={e => update("forecastHorizon", Number(e.target.value))}
                className="w-full text-sm text-dark border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:outline-none focus:border-slate-400"
              >
                {[1, 2, 3, 6, 9, 12].map(m => (
                  <option key={m} value={m}>{m} month{m > 1 ? "s" : ""}{m === 3 ? " (default)" : ""}</option>
                ))}
              </select>
            </SettingRow>
          </div>
        </div>

        {/* Danger zone */}
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-danger/10 bg-danger-light/40">
            <p className="text-xs font-semibold text-danger uppercase tracking-widest">Danger zone</p>
          </div>
          <div className="px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-dark">Reset to defaults</p>
              <p className="text-xs text-grey-400 mt-0.5">Restore all CFO parameters to their factory defaults. This cannot be undone.</p>
            </div>
            <button
              onClick={() => setSettings({
                monthlyBurnBudget: 465, maxCostToRevenueRatio: 80,
                reservePercentage: 20, autoApproveThreshold: 1.00,
                weeklyScenarioAutoApply: "base", planApprovalDeadline: 3,
                scenarioGenerationDay: 0, forecastHorizon: 3,
              })}
              className="shrink-0 px-4 py-2 rounded-xl border border-danger/30 text-sm font-medium text-danger hover:bg-danger-light transition-colors"
            >
              Reset defaults
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom save bar ── */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
        <Link
          href="/agents/cfo"
          className="px-4 py-2 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors disabled:opacity-60"
        >
          {saved
            ? <><CheckCircle2 size={15} /> Saved</>
            : saving
            ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
            : <><Save size={15} /> Save changes</>
          }
        </button>
      </div>
    </div>
  );
}
