"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpcClient } from "@/trpc/react";

interface WaitlistFormProps {
  className?: string;
  size?: "default" | "lg";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistForm({ className, size = "default" }: WaitlistFormProps) {
  const t = useTranslations("Landing");
  const locale = useLocale();
  const [email, setEmail] = useState("");

  const trimmed = email.trim();
  const isValid = EMAIL_RE.test(trimmed);

  const mutation = useMutation({
    mutationFn: (input: { email: string }) =>
      trpcClient.waitlist.signup.mutate({
        email: input.email,
        locale,
      }),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || mutation.isPending) return;
    mutation.mutate({ email: trimmed });
  };

  if (mutation.isSuccess) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-md bg-primary/10 px-4 py-3 text-sm font-medium text-primary",
          className,
        )}
      >
        <Check className="size-4" />
        {mutation.data?.alreadySignedUp ? t("waitlistAlready") : t("waitlistSuccess")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("flex w-full max-w-md flex-col gap-2", className)}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("waitlistEmailPlaceholder")}
          aria-label={t("waitlistEmailPlaceholder")}
          disabled={mutation.isPending}
          className={cn(
            "bg-background dark:bg-background",
            "focus-visible:bg-background dark:focus-visible:bg-background",
            size === "lg" && "h-11 text-base",
          )}
        />
        <Button
          type="submit"
          disabled={!isValid || mutation.isPending}
          size={size === "lg" ? "lg" : "default"}
          className="disabled:opacity-100 disabled:brightness-75"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("waitlistSubmitting")}
            </>
          ) : (
            t("waitlistSubmit")
          )}
        </Button>
      </div>
      {mutation.isError ? <p className="text-sm text-destructive">{t("waitlistError")}</p> : null}
    </form>
  );
}
