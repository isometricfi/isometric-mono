"use client";

import { useEffect } from "react";

const INVITE_CODE_STORAGE_KEY = "volumetric.inviteCode";
const INVITE_CODE_PATTERN = /^[A-Z0-9]{6}$/;

interface CaptureInviteCodeProps {
  id: string;
}

export function CaptureInviteCode({ id }: CaptureInviteCodeProps) {
  useEffect(() => {
    const normalizedId = id.trim().toUpperCase();
    if (!INVITE_CODE_PATTERN.test(normalizedId)) {
      return;
    }

    window.sessionStorage.setItem(INVITE_CODE_STORAGE_KEY, normalizedId);
  }, [id]);

  return null;
}
