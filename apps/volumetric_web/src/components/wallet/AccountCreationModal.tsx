"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EnsureAccountStep } from "@/hooks";
import { cn } from "@/lib/utils";

const STEPS: { id: EnsureAccountStep; title: string; description: string }[] = [
  {
    id: "checking",
    title: "Setting up your account",
    description: "Preparing account creation.",
  },
  {
    id: "awaiting_signature",
    title: "Approve account creation",
    description: "Sign the message in your wallet to prove creation",
  },
  {
    id: "creating",
    title: "Creating account",
    description: "Finalizing account setup.",
  },
];

function isStepActive(current: EnsureAccountStep, step: EnsureAccountStep) {
  if (current === "checking") return step === "checking";
  if (current === "awaiting_signature") return step === "awaiting_signature";
  if (current === "creating") return step === "creating";
  return false;
}

function isStepComplete(current: EnsureAccountStep, step: EnsureAccountStep) {
  if (current === "awaiting_signature") return step === "checking";
  if (current === "creating") return step === "checking" || step === "awaiting_signature";
  return false;
}

export function AccountCreationModal({
  open,
  step,
  error,
  onClose,
}: {
  open: boolean;
  step: EnsureAccountStep;
  error: string | null;
  onClose: () => void;
}) {
  const showClose = step === "error" || step === "awaiting_signature";

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent showCloseButton={showClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Account setup
          </DialogTitle>
          <DialogDescription>
            {error ? "Something went wrong. You can close this and try again by reconnecting." : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {STEPS.map((s) => {
            const active = isStepActive(step, s.id);
            const complete = isStepComplete(step, s.id);

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "rounded-lg border p-4",
                  active && "border-primary/40 bg-primary/5",
                  complete && "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {complete ? (
                      <CheckCircle2 className="size-5 text-primary" />
                    ) : active ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <div className="size-5 rounded-full border" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-medium leading-none">{s.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{s.description}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4">
              <div className="text-sm font-medium">{error}</div>
              <div className="mt-3 flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
