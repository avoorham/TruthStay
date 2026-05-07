"use client";
import { useState, useEffect } from "react";

export interface InlineEditState<T> {
  value:     T;
  isEditing: boolean;
  isSaving:  boolean;
  error:     string | null;
}

export interface UseInlineEditOpts<T> {
  initialValue: T;
  onSave:       (newValue: T) => Promise<void>;
  validate?:    (value: T) => string | null;
}

export function useInlineEdit<T>({ initialValue, onSave, validate }: UseInlineEditOpts<T>): {
  state:       InlineEditState<T>;
  startEdit:   () => void;
  setValue:    (v: T) => void;
  saveAndExit: () => Promise<void>;
  cancel:      () => void;
} {
  const [draft,     setDraft]     = useState<T>(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Sync draft when parent updates the value (after successful save)
  useEffect(() => {
    if (!isEditing) setDraft(initialValue);
  }, [initialValue, isEditing]);

  function startEdit() {
    setDraft(initialValue);
    setError(null);
    setIsEditing(true);
  }

  function setValue(v: T) {
    setDraft(v);
  }

  async function saveAndExit() {
    if (validate) {
      const err = validate(draft);
      if (err) { setError(err); return; }
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(draft);
      setIsEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  function cancel() {
    setIsEditing(false);
    setError(null);
    setDraft(initialValue);
  }

  return {
    state: { value: isEditing ? draft : initialValue, isEditing, isSaving, error },
    startEdit,
    setValue,
    saveAndExit,
    cancel,
  };
}
