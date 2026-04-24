"use client";

import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { MenuIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useDynamicConfig } from "@/app/providers/dynamic-provider";
import { SettingsDropdown } from "@/components/layout/SettingsDropdown";
import { SystemSettings } from "@/components/layout/SystemSettings";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Link, usePathname } from "@/i18n/routing";
import { isWaitlistMode } from "@/lib/site-links";
import { appUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { primaryWallet } = useDynamicContext();
  const { isConfigured } = useDynamicConfig();
  const isLandingPage = pathname === "/";
  const waitlistMode = isWaitlistMode();
  const t = useTranslations("Navbar");
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative z-20 mx-auto mt-4 w-full max-w-5xl px-0">
      <div className="border rounded-xl bg-background/80 backdrop-blur-sm overflow-visible">
        <div className="mx-auto flex md:h-14 h-12 max-w-7xl items-center justify-between  px-2 md:px-3 md:grid md:grid-cols-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Image
                src="/logo.svg"
                alt="Isometric"
                width={32}
                height={32}
                className="min-w-[32px] min-h-[32px]"
              />
              <span className="md:block hidden">Isometric</span>
            </Link>
            <Drawer open={open} onOpenChange={setOpen}>
              <DrawerTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <MenuIcon className="size-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DrawerTrigger>
              <DrawerContent className="px-5 pb-8">
                <DrawerTitle className="sr-only">Navigation</DrawerTitle>
                <div className="flex flex-col gap-2 mt-2">
                  {!waitlistMode && (
                    <>
                      <Link href="/write" onClick={() => setOpen(false)}>
                        <Button
                          variant="ghost"
                          size="lg"
                          className={cn(
                            "w-full justify-start",
                            pathname === "/write" && "font-bold",
                          )}
                        >
                          {t("write")}
                        </Button>
                      </Link>
                      <Link href="/buy" onClick={() => setOpen(false)}>
                        <Button
                          variant="ghost"
                          size="lg"
                          className={cn("w-full justify-start", pathname === "/buy" && "font-bold")}
                        >
                          {t("buy")}
                        </Button>
                      </Link>
                      {!isLandingPage && (
                        <Link href="/portfolio" onClick={() => setOpen(false)}>
                          <Button
                            variant="ghost"
                            size="lg"
                            className={cn(
                              "w-full justify-start",
                              pathname === "/portfolio" && "font-bold",
                            )}
                          >
                            {t("portfolio")}
                          </Button>
                        </Link>
                      )}
                    </>
                  )}
                  {!primaryWallet && (
                    <div className="mt-4 pt-4 border-t">
                      <SystemSettings showHeading={false} />
                    </div>
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
          <div className="hidden md:flex items-center gap-0.5 justify-center">
            {!waitlistMode && (
              <>
                <Link href="/write">
                  <Button variant="ghost" className={cn(pathname === "/write" && "font-bold")}>
                    {t("write")}
                  </Button>
                </Link>
                <Link href="/buy">
                  <Button variant="ghost" className={cn(pathname === "/buy" && "font-bold")}>
                    {t("buy")}
                  </Button>
                </Link>
                {primaryWallet && (
                  <Link href="/portfolio">
                    <Button
                      variant="ghost"
                      className={cn(pathname === "/portfolio" && "font-bold")}
                    >
                      {t("portfolio")}
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-3 justify-center md:justify-end -mr-0.5">
            {!primaryWallet && (
              <div className="md:flex hidden">
                <SettingsDropdown />
              </div>
            )}

            {waitlistMode ? null : isLandingPage ? (
              <Button asChild>
                <a href={appUrl("/write")}>{t("openApp")}</a>
              </Button>
            ) : isConfigured ? (
              <ConnectButton />
            ) : (
              <Button disabled>{t("connect")}</Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
