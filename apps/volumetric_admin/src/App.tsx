import { Sidebar as KumoSidebarShell } from "@cloudflare/kumo";
import { ShieldCheck } from "@phosphor-icons/react";
import { useMemo } from "react";
import { Mono } from "./components/Mono";
import { Sidebar } from "./components/Sidebar";
import { ConnectionProvider } from "./lib/connection-context";
import { shortPrincipal } from "./lib/format";
import { getWhitelistedPrincipalText } from "./lib/identity";
import { useHashRoute } from "./lib/router";
import { ROUTE_PATHS, ROUTES, SIDEBAR_GROUPS } from "./routes";

function App() {
  return (
    <ConnectionProvider>
      <Shell />
    </ConnectionProvider>
  );
}

function Shell() {
  const { path, navigate } = useHashRoute(ROUTE_PATHS);
  const route = ROUTES[path] ?? ROUTES["/solvency"];

  const adminPrincipal = useMemo(() => {
    try {
      return getWhitelistedPrincipalText();
    } catch {
      return null;
    }
  }, []);

  return (
    <div
      data-mode="dark"
      data-theme="kumo"
      className="flex min-h-screen flex-col bg-kumo-canvas text-kumo-default"
    >
      <HeaderBar adminPrincipal={adminPrincipal} activeLabel={route.label} />
      <KumoSidebarShell.Provider
        collapsible="none"
        defaultOpen
        defaultWidth={240}
        className="flex min-h-0 flex-1 w-full"
      >
        <Sidebar groups={SIDEBAR_GROUPS} activePath={path} onNavigate={navigate} />
        <main className="min-w-0 flex-1 overflow-x-hidden px-8 pb-20 pt-2">
          <div key={path} className="mx-auto w-full max-w-[1200px]">
            {route.render()}
          </div>
        </main>
      </KumoSidebarShell.Provider>
    </div>
  );
}

function HeaderBar({
  adminPrincipal,
  activeLabel,
}: {
  adminPrincipal: string | null;
  activeLabel: string;
}) {
  return (
    <header className="sticky top-0 z-10 border-b vol-hairline-strong bg-kumo-canvas/90 backdrop-blur">
      <div className="flex items-center justify-between gap-6 px-6 py-3.5">
        <div className="flex items-center gap-3">
          <span className="vol-accent-dot" aria-hidden />
          <Mono className="text-[11px] uppercase tracking-[0.18em] text-kumo-subtle">
            Volumetric
          </Mono>
          <span className="text-kumo-inactive">/</span>
          <span className="text-[13px] font-medium text-kumo-strong">Admin Console</span>
          <span className="text-kumo-inactive">/</span>
          <span className="text-[13px] text-kumo-default">{activeLabel}</span>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ShieldCheck size={14} className="text-kumo-brand" weight="fill" />
          <Mono className="text-[12px] text-kumo-subtle">
            {adminPrincipal ? shortPrincipal(adminPrincipal) : "no identity"}
          </Mono>
        </div>
      </div>
    </header>
  );
}

export default App;
