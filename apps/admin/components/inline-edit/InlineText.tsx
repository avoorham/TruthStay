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

export function InlineText({
  value, onSave, className, placeholder, minLen = 2, maxLen = 200, onEditingChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

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
  useEffect(() => { if (state.isEditing) inputRef.current?.focus(); }, [state.isEditing]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  { e.preventDefault(); saveAndExit(); }
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
  }

  if (state.isEditing) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            value={state.value}
            onChange={e => setValue(e.target.value)}
            onBlur={saveAndExit}
            onKeyDown={onKeyDown}
            className={cn(
              "w-full bg-transparent border-b-2 border-teal-400 focus:outline-none pr-6",
              state.error && "border-red-400",
              className,
            )}
          />
          {state.isSaving && (
            <Loader2 size={11} className="absolute right-1 animate-spin text-slate-400" />
          )}
        </div>
        {state.error && <p className="text-[10px] text-red-500">{state.error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className={cn(
        "group text-left w-full rounded px-0.5 -mx-0.5 hover:bg-slate-100 cursor-text transition-colors flex items-center gap-1",
        className,
      )}
    >
      <span className={!value ? "text-grey-400 italic" : ""}>{value || placeholder}</span>
      <Pencil
        size={10}
        className="opacity-0 group-hover:opacity-40 flex-shrink-0 transition-opacity text-grey-500"
      />
    </button>
  );
}
