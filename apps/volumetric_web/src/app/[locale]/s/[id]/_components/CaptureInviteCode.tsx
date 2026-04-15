"use client";

import { useEffect } from "react";
import { setInviteCodeInSession } from "@/lib/referrals/invite-code";

interface CaptureInviteCodeProps {
  id: string;
}

export function CaptureInviteCode({ id }: CaptureInviteCodeProps) {
  useEffect(() => {
    setInviteCodeInSession(id);
  }, [id]);

  return null;
}
