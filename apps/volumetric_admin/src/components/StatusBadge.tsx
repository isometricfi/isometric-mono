import { Loader } from "@cloudflare/kumo";

export type AsyncPhase = "idle" | "loading" | "ready" | "error";

export function StatusBadge({ phase, status }: { phase: AsyncPhase; status: string }) {
  const dotColorClass =
    phase === "error"
      ? "bg-red-400"
      : phase === "ready"
        ? "bg-emerald-400"
        : phase === "loading"
          ? "bg-amber-400 animate-pulse"
          : "bg-kumo-inactive";

  return (
    <div className="flex items-center gap-2">
      {phase === "loading" ? (
        <Loader size="sm" />
      ) : (
        <span className={`size-1.5 rounded-full ${dotColorClass}`} aria-hidden />
      )}
      <span className="text-[13px] text-kumo-subtle">{status}</span>
    </div>
  );
}
