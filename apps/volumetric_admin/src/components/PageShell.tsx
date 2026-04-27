import { Banner } from "@cloudflare/kumo";
import { WarningCircle } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";
import { type AsyncPhase, StatusBadge } from "./StatusBadge";

export function PageShell({
  eyebrow,
  title,
  description,
  action,
  phase,
  statusText,
  error,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  phase: AsyncPhase;
  statusText: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <section className="relative border-b vol-hairline py-8">
        <div className="vol-grid-bg absolute inset-0 -z-0 opacity-25" aria-hidden />
        <div className="relative z-10 flex items-end justify-between gap-6">
          <div className="flex max-w-[60ch] flex-col gap-2">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.015em] text-kumo-strong">
              {title}
            </h1>
            <p className="text-[13px] leading-relaxed text-kumo-subtle">{description}</p>
          </div>
          {action ? <div className="flex items-center gap-3">{action}</div> : null}
        </div>
        <div className="relative z-10 mt-4">
          <StatusBadge phase={phase} status={statusText} />
        </div>
      </section>

      {error ? (
        <div className="mt-6">
          <Banner
            icon={<WarningCircle weight="fill" />}
            variant="error"
            title="Query failed"
            description={error}
          />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </div>
  );
}
