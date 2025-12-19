"use client";

import { Moon, Sun } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useDynamicConfig } from "@/app/providers/dynamic-provider";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isConfigured } = useDynamicConfig();
  const isLandingPage = pathname === "/";

  return (
    <nav className="fixed top-4 left-1/2  -translate-x-1/2 z-50 w-full max-w-5xl xl:px-0 px-4 ">
      <div className="border rounded-full bg-background/80 backdrop-blur-sm overflow-visible">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:grid md:grid-cols-3">
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Image
              src="/logo.svg"
              alt="Volumetric"
              width={32}
              height={32}
              className="min-w-[32px] min-h-[32px]"
            />
            <span className="md:block hidden">Volumetric</span>
          </Link>
          <div className="flex items-center gap-0 md:gap-3 md:justify-center">
            <Link href="/write">
              <Button
                variant="ghost"
                size="sm"
                className={cn(pathname === "/write" && "font-bold")}
              >
                Write
              </Button>
            </Link>

            <Link href="/buy">
              <Button variant="ghost" size="sm" className={cn(pathname === "/buy" && "font-bold")}>
                Buy
              </Button>
            </Link>
            {!isLandingPage && (
              <Link href="/portfolio">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(pathname === "/portfolio" && "font-bold")}
                >
                  Portfolio
                </Button>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-3 justify-center md:justify-end">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label="Toggle theme"
              className="md:flex hidden  items-center justify-center"
            >
              {theme === "light" ? <Moon className="size-5" /> : <Sun className="size-5" />}
            </Button>

            {isLandingPage ? (
              <Button asChild>
                <Link href="/write">Open App</Link>
              </Button>
            ) : isConfigured ? (
              <ConnectButton />
            ) : (
              <Button disabled>Connect</Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
