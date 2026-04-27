import { Empty, LayerCard, Loader } from "@cloudflare/kumo";
import type { ReactNode } from "react";
import type { AsyncPhase } from "./StatusBadge";

export function AsyncState({
  phase,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  loadingText = "Loading...",
  children,
}: {
  phase: AsyncPhase;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: ReactNode;
  loadingText?: string;
  children: ReactNode;
}) {
  if (phase === "loading") {
    return (
      <LayerCard className="flex items-center justify-center gap-3 border vol-hairline p-10">
        <Loader size="sm" />
        <span className="text-[13px] text-kumo-subtle">{loadingText}</span>
      </LayerCard>
    );
  }

  if (phase === "idle") {
    return <Empty size="sm" icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return <>{children}</>;
}
