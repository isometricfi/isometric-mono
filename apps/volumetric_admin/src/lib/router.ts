import { useEffect, useState } from "react";

export const DEFAULT_ROUTE = "/solvency";

export type RouteHandle = {
  path: string;
  navigate: (next: string) => void;
};

export function useHashRoute(knownPaths: readonly string[]): RouteHandle {
  const [path, setPath] = useState<string>(() => normalizePath(window.location.hash, knownPaths));

  useEffect(() => {
    function handleHashChange() {
      setPath(normalizePath(window.location.hash, knownPaths));
    }
    window.addEventListener("hashchange", handleHashChange);

    if (window.location.hash === "" || window.location.hash === "#") {
      window.location.hash = `#${DEFAULT_ROUTE}`;
    }

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [knownPaths]);

  function navigate(next: string) {
    const normalized = next.startsWith("/") ? next : `/${next}`;
    if (window.location.hash !== `#${normalized}`) {
      window.location.hash = `#${normalized}`;
    }
  }

  return { path, navigate };
}

function normalizePath(rawHash: string, knownPaths: readonly string[]): string {
  const candidate = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  const withLeadingSlash = candidate.startsWith("/") ? candidate : `/${candidate}`;
  if (withLeadingSlash === "/" || withLeadingSlash === "") {
    return DEFAULT_ROUTE;
  }
  if (!knownPaths.includes(withLeadingSlash)) {
    return DEFAULT_ROUTE;
  }
  return withLeadingSlash;
}
