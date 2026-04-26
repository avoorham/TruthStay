"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "Confirm", variant = "default", onConfirm, loading,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
              variant === "danger" ? "bg-danger-light" : "bg-blue-light"
            )}>
              <AlertTriangle size={18} className={variant === "danger" ? "text-danger" : "text-blue"} />
            </div>
            <div>
              <Dialog.Title className="font-display font-bold text-dark">{title}</Dialog.Title>
              <Dialog.Description className="text-sm text-grey-700 mt-1">{description}</Dialog.Description>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-grey-700 hover:bg-grey-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-lg transition disabled:opacity-50",
                variant === "danger"
                  ? "bg-danger text-white hover:bg-red-700"
                  : "bg-blue text-white hover:bg-blue-dark"
              )}
            >
              {loading ? "…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
