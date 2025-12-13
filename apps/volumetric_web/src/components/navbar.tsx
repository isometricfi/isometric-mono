"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

export function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const isLandingPage = pathname === "/";

  return (
    <nav className="fixed top-4 left-1/2  -translate-x-1/2 z-50 w-full max-w-5xl md:px-0 px-4 ">
      <div className=" border rounded-full bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-semibold tracking-tight"
          >
            <Image
              src="/logo.svg"
              alt="Volumetric"
              width={32}
              height={32}
              className="min-w-[32px] min-h-[32px]"
            />
            <span className="md:block hidden">Volumetric</span>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              <Link href="/">Writers</Link>
            </Button>
            <Button variant="ghost" size="sm">
              <Link href="/about">Buyers</Link>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              aria-label="Toggle theme"
              className="md:block hidden"
            >
              {theme === "light" ? (
                <Moon className="size-5" />
              ) : (
                <Sun className="size-5" />
              )}
            </Button>

            <Button asChild>
              <Link href={isLandingPage ? "/app" : "#"}>
                {isLandingPage ? "Open App" : "Connect"}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
