"use client";

import { useEffect } from "react";
import { setInviteCodeInSession } from "@/lib/referrals/invite-code";

export function CaptureInviteCodeFromQuery() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setInviteCodeInSession(ref);
    }
  }, []);

  return null;
}
