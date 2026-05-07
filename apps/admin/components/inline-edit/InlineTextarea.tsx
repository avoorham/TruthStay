"use client";
import { useRef, useEffect, KeyboardEvent } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { useInlineEdit } from "./useInlineEdit";
import { cn } from "@/lib/utils";

interface Props {
  value:        string;
  onSave:       (v: string) => Promise<void>;
  className?:   string;
  placeholder?: string;
  minLen?:      number;
  maxLen?:      number;
  onEditingChange?: (editing: boolean) => void;
}

export function InlineTextarea({
  value, onSave, className, placeholder, minLen = 10, maxLen = 2000, onEditingChange,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function validate(v: string) {
    const t = v.trim();
    if (t.length < minLen) return `Must be at least ${minLen} characters`;
    if (t.length > maxLen) return `Must be at most ${maxLen} characters`;
    return null;
  }

  const { state, startEdit, setValue, saveAndExit, cancel } = useInlineEdit({
    initialValue: value,
    onSave: async (v) => { await onSave(v.trim()); },
    validate,
  });

  useEffect(() => { onEditingChange?.(state.isEditing); }, [state.isEditing]);

  useEffect(() => {
    if (state.isEditing && ref.current) {
      ref.current.focus();
      // Auto-resize to content
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }, [state.isEditing]);

  function autoResize() {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveAndExit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }

  if (state.isEditing) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="relative">
          <textarea
            ref={ref}
            value={state.value}
            onChange={e => { setValue(e.target.value); autoResize(); }}
            onBlur={saveAndExit}
            onKeyDown={onKeyDown}
            rows={3}
            className={cn(
              "w-full resize-none bg-white border border-slate-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-teal-400 pr-6",
              state.error && "border-red-400",
              className,
            )}
          />
          {state.isSaving && (
            <Loader2 size={11} className="absolute top-2 right-2 animate-spin text-slate-400" />
          )}
        </div>
        <p className="text-[10px] text-grey-400">⌘+Enter to save · Esc to cancel</p>
        {state.error && <p className="text-[10px] text-red-500">{state.error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className={cn(
        "group text-left w-full rounded px-0.5 -mx-0.5 hover:bg-slate-100 cursor-text transition-colors",
        className,
      )}
    >
      <span className={cn("flex items-start gap-1", !value && "text-grey-400 italic")}>
        <span className="flex-1">{value || placeholder}</span>
        <Pencil
          size={10}
          className="opacity-0 group-hover:opacity-40 flex-shrink-0 mt-0.5 transition-opacity text-grey-500"
        />
      </span>
    </button>
  );
}
