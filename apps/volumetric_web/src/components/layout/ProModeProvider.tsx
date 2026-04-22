"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";

export const PRO_MODE_COOKIE = "vm_pro_mode";

interface ProModeContextValue {
  isProMode: boolean;
  setProMode: (value: boolean) => void;
}

const ProModeContext = createContext<ProModeContextValue | null>(null);

export function ProModeProvider({ initial, children }: { initial: boolean; children: ReactNode }) {
  const [isProMode, setIsProMode] = useState(initial);

  const setProMode = useCallback((value: boolean) => {
    setIsProMode(value);
    const secure = process.env.NODE_ENV === "production" ? "; secure" : "";
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API lacks Safari/Firefox support; document.cookie is fine for a single preference write.
    document.cookie = `${PRO_MODE_COOKIE}=${value ? "1" : "0"}; path=/; max-age=31536000; samesite=lax${secure}`;
  }, []);

  return (
    <ProModeContext.Provider value={{ isProMode, setProMode }}>{children}</ProModeContext.Provider>
  );
}

export function useProMode() {
  const ctx = useContext(ProModeContext);
  if (!ctx) throw new Error("useProMode must be used within ProModeProvider");
  return ctx;
}
