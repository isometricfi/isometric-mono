"use client";

import { MenuIcon, Sparkles } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { OpenAppLink } from "@/components/marketing/OpenAppLink";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";

export function Navbar() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const t = useTranslations("Navbar");
  const [open, setOpen] = useState(false);

  return (
    <nav className="relative z-20 mx-auto mt-4 w-full max-w-5xl px-0">
      <div className="border rounded-xl bg-background/80 backdrop-blur-sm overflow-visible">
        <div className="relative mx-auto flex md:h-14 h-12 max-w-7xl items-center justify-between  px-2 md:px-3 md:grid md:grid-cols-3">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Image
                src="/logo.svg"
                alt="Isometric"
                width={32}
                height={32}
                className="min-w-[32px] min-h-[32px]"
              />
              <span className="md:block hidden">Isometric</span>{" "}
              {!isLandingPage && (
                <Badge variant={"soft"} className="md:flex hidden">
                  <Sparkles /> {t("v1Demo")}
                </Badge>
              )}
            </Link>
            {!isLandingPage && (
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
                    <Link href="/write" onClick={() => setOpen(false)}>
                      <Button
                        variant="ghost"
                        size="lg"
                        className={cn("w-full justify-start", pathname === "/write" && "font-bold")}
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
                  </div>
                </DrawerContent>
              </Drawer>
            )}
          </div>
          {!isLandingPage && (
            <Badge
              variant={"soft"}
              className="md:hidden absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              {t("v1Demo")}
            </Badge>
          )}
          <div className="hidden md:flex items-center gap-0.5 justify-center">
            {!isLandingPage && (
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
                <Link href="/portfolio">
                  <Button variant="ghost" className={cn(pathname === "/portfolio" && "font-bold")}>
                    {t("portfolio")}
                  </Button>
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 justify-center md:justify-end -mr-1">
            {isLandingPage ? (
              <Button asChild>
                <OpenAppLink path="/write">
                  <span className="hidden sm:inline">{t("openV1Demo")}</span>
                  <span className="sm:hidden">{t("v1Demo")}</span>
                </OpenAppLink>
              </Button>
            ) : (
              <ConnectButton />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
