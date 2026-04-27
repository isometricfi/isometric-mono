import { LayerCard } from "@cloudflare/kumo";
import { Eyebrow } from "./Eyebrow";

export function MetricCard({
  label,
  value,
  mono = false,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "warn" | "danger" | "ok";
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
        className={`mt-1.5 text-[17px] font-semibold tracking-tight text-kumo-strong ${mono ? "font-mono text-[15px]" : ""}`}
      >
        {value}
      </div>
    </LayerCard>
  );
}
