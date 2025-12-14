"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type ReactNode } from "react";

interface HowItWorksModalProps {
  trigger: ReactNode;
}

export function HowItWorksModal({ trigger }: HowItWorksModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How writing options works</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium">1. You create an offer</p>
            <p className="text-muted-foreground">
              Set your terms — strike price, premium, and amount. Your offer
              goes live for buyers to accept.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">2. Buyers accept</p>
            <p className="text-muted-foreground">
              Your offer can be filled by one or many buyers. Each time someone
              takes part of your offer, that portion of BTC is locked and you
              instantly receive the premium for that amount.
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">3. At expiry</p>
            <p className="text-muted-foreground">
              If BTC is <span className="font-medium">below</span> your strike
              price — you keep everything. Your collateral unlocks and the
              premium is yours.
            </p>
            <p className="text-muted-foreground">
              If BTC is <span className="font-medium">above</span> your strike
              price — the buyer&apos;s profit is automatically settled from your
              collateral. You still keep the premium.
            </p>
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Example: You write a call at $100k strike with 1 BTC collateral.
              If BTC expires at $90k, you keep everything. If it expires at
              $110k, ~0.09 BTC goes to the buyer and you keep ~0.91 BTC plus
              your premium.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
