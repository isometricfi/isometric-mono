"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { readInviteCodeFromSession } from "@/lib/referrals/invite-code";
import { appUrl } from "@/lib/urls";

interface OpenAppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  path: string;
  children: ReactNode;
}

export function OpenAppLink({ path, children, ...rest }: OpenAppLinkProps) {
  const [href, setHref] = useState(() => appUrl(path));

  useEffect(() => {
    const base = appUrl(path);
    const code = readInviteCodeFromSession();
    if (!code) {
      setHref(base);
      return;
    }
    const url = new URL(base, window.location.origin);
    url.searchParams.set("ref", code);
    setHref(url.toString());
  }, [path]);

  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
