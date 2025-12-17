"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CallWriteHowItWorksModalProps {
  trigger: ReactNode;
}

export function CallWriteHowItWorksModal({ trigger }: CallWriteHowItWorksModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How writing options works</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">1. Create an offer</p>
            <p className="text-muted-foreground">
              Set strike (% above current), premium, and amount. Offers can be partially filled by
              multiple buyers — you receive premium instantly for each fill.
            </p>
          </div>

          <div>
            <p className="font-medium">2. At expiry</p>
            <p className="text-muted-foreground">
              <span className="font-medium">Below</span> strike — you keep everything.{" "}
              <span className="font-medium">Above</span> strike — buyer&apos;s profit settles from
              collateral. You always keep the premium.
            </p>
          </div>

          <div>
            <p className="font-medium">Covered calls</p>
            <p className="text-muted-foreground">
              Your BTC backs the option. Max loss is collateral minus premium.
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Example: 1 BTC at +10% strike, 2% premium. If BTC is $100k when accepted, strike is
              $110k. Expires below $110k → keep 1.02 BTC. Expires at $121k → ~0.93 BTC (0.91 + 0.02
              premium).
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
