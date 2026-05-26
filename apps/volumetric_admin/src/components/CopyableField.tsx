import { Button } from "@cloudflare/kumo";
import { Copy } from "@phosphor-icons/react";
import { Mono } from "./Mono";

export function CopyableField({ ariaLabel, value }: { ariaLabel: string; value: string }) {
  return (
    <div className="flex max-w-md items-start gap-1.5">
      <Mono className="min-w-0 flex-1 break-all text-sm">{value}</Mono>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        icon={<Copy />}
        onClick={() => void navigator.clipboard.writeText(value)}
        aria-label={`Copy ${ariaLabel}`}
      />
    </div>
  );
}
