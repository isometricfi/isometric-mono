import { Copy } from "@phosphor-icons/react";
import type { ReactNode } from "react";

export function CopyButton({ value, children }: { value: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <button
        type="button"
        className="inline-flex shrink-0 cursor-pointer rounded p-0.5 text-kumo-subtle hover:text-kumo-strong hover:bg-kumo-surface-hover transition-colors"
        onClick={() => void navigator.clipboard.writeText(value)}
        aria-label="Copy to clipboard"
      >
        <Copy size={12} />
      </button>
    </span>
  );
}
