"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useNearWallet } from "../lib/useNearWallet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MandateMark } from "@/components/MandateMark";
import { RiWalletLine, RiLogoutBoxRLine, RiSunLine, RiMoonClearLine } from "@remixicon/react";

const NAV = [
  { href: "/swarm", label: "Hire a Swarm" },
  { href: "/developers", label: "Developers" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { accountId, connect, disconnect } = useNearWallet();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="order-1 flex items-center gap-1.5 font-heading text-sm font-medium tracking-tight"
        >
          <MandateMark className="size-5 text-primary" />
          Mandate
        </Link>

        <div className="order-2 flex items-center gap-2 sm:order-3">
          <Button
            variant="ghost"
            size="icon"
            title={mounted ? (resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode") : undefined}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            {mounted && resolvedTheme === "dark" ? (
              <RiSunLine className="size-4" />
            ) : (
              <RiMoonClearLine className="size-4" />
            )}
          </Button>

          {accountId ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => disconnect()}
              title="Disconnect wallet"
            >
              <span className="max-w-[10ch] truncate sm:max-w-[20ch]">{accountId}</span>
              <RiLogoutBoxRLine className="size-3.5" />
            </Button>
          ) : (
            <Button size="sm" className="gap-2" onClick={() => connect()}>
              <RiWalletLine className="size-3.5" />
              Connect wallet
            </Button>
          )}
        </div>

        <nav className="order-3 flex w-full items-center gap-1 sm:order-2 sm:w-auto">
          {NAV.map((item) => (
            <Button
              key={item.href}
              render={<Link href={item.href} />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className={cn("text-muted-foreground", pathname === item.href && "bg-muted text-foreground")}
            >
              {item.label}
            </Button>
          ))}
        </nav>
      </div>
    </header>
  );
}
