"use client";

import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CallBuyHowItWorksModalProps {
  trigger: ReactNode;
}

export function CallBuyHowItWorksModal({ trigger }: CallBuyHowItWorksModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How buying call options works</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium">1. Choose & pay</p>
            <p className="text-muted-foreground">
              Select term, strike (% above current), and amount. We automatically find the lowest
              premium offer with enough liquidity. This premium is your max loss.
            </p>
          </div>

          <div>
            <p className="font-medium">2. At expiry</p>
            <p className="text-muted-foreground">
              <span className="font-medium">Below</span> strike — option expires worthless.{" "}
              <span className="font-medium">Above</span> strike — you auto-receive profit in BTC.
            </p>
          </div>

          <div>
            <p className="font-medium">Covered calls</p>
            <p className="text-muted-foreground">
              Writer&apos;s BTC backs the option. Max profit is option amount minus premium paid.
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Example: 0.1 BTC at +10% strike, 2% premium (0.002 BTC). If BTC is $100k when
              purchased, strike is $110k. Expires at $121k → ~0.009 BTC profit. Max profit → ~0.098
              BTC.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
