"use client";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option { value: string; label: string; }

interface Props {
  value:    string;
  options:  Option[];
  onSave:   (v: string) => Promise<void>;
  className?: string;
  onEditingChange?: (editing: boolean) => void;
}

export function InlineSelect({ value, options, onSave, className, onEditingChange }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => { onEditingChange?.(isEditing); }, [isEditing]);

  const label = options.find(o => o.value === value)?.label ?? value;

  async function handleChange(newVal: string) {
    setSaving(true);
    setError(null);
    try {
      await onSave(newVal);
      setIsEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing) {
    return (
      <span className="inline-flex items-center gap-1">
        <select
          autoFocus
          defaultValue={value}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => { if (!saving) setIsEditing(false); }}
          onKeyDown={e => { if (e.key === "Escape") setIsEditing(false); }}
          disabled={saving}
          className={cn(
            "text-xs border border-teal-400 rounded px-2 py-0.5 focus:outline-none bg-white capitalize",
            className,
          )}
        >
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {saving && <Loader2 size={11} className="animate-spin text-slate-400" />}
        {error  && <span className="text-[10px] text-red-500">{error}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={cn(
        "group inline-flex items-center gap-0.5 text-xs rounded px-1 -mx-1 hover:bg-slate-100 transition-colors capitalize",
        className,
      )}
    >
      {label}
      <span className="opacity-0 group-hover:opacity-50 text-grey-500 transition-opacity">▾</span>
    </button>
  );
}
