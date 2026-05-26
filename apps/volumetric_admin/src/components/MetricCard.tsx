import { LayerCard } from "@cloudflare/kumo";
import { Copy } from "@phosphor-icons/react";
import { Eyebrow } from "./Eyebrow";

export function MetricCard({
  label,
  value,
  mono = false,
  tone = "default",
  copyValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "warn" | "danger" | "ok";
  copyValue?: string;
}) {
  const toneRailClass =
    tone === "danger"
      ? "border-l-kumo-danger"
      : tone === "warn"
        ? "border-l-kumo-warning"
        : tone === "ok"
          ? "border-l-kumo-success"
          : "border-l-kumo-brand";

  return (
    <LayerCard className={`rounded-none border-l-2 ${toneRailClass} p-3`}>
      <Eyebrow>{label}</Eyebrow>
      <div
        className={`mt-1.5 flex items-center gap-1 text-[17px] font-semibold tracking-tight text-kumo-strong ${mono ? "font-mono text-[15px]" : ""}`}
      >
        {value}
        {copyValue ? (
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer rounded p-0.5 text-kumo-subtle hover:text-kumo-strong hover:bg-kumo-surface-hover transition-colors"
            onClick={() => void navigator.clipboard.writeText(copyValue)}
            aria-label="Copy to clipboard"
          >
            <Copy size={12} />
          </button>
        ) : null}
      </div>
    </LayerCard>
  );
}
