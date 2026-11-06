"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNearWallet } from "../lib/useNearWallet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RiWalletLine, RiLogoutBoxRLine, RiShieldCheckLine } from "@remixicon/react";

const NAV = [
  { href: "/swarm", label: "Hire a Swarm" },
  { href: "/developers", label: "Developers" },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { accountId, connect, disconnect } = useNearWallet();

  return (
    <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="order-1 flex items-center gap-1.5 font-heading text-sm font-medium tracking-tight"
        >
          <RiShieldCheckLine className="size-4" />
          Mandate
        </Link>

        {accountId ? (
          <Button
            variant="outline"
            size="sm"
            className="order-2 gap-2 sm:order-3"
            onClick={() => disconnect()}
            title="Disconnect wallet"
          >
            <span className="max-w-[10ch] truncate sm:max-w-[20ch]">{accountId}</span>
            <RiLogoutBoxRLine className="size-3.5" />
          </Button>
        ) : (
          <Button size="sm" className="order-2 gap-2 sm:order-3" onClick={() => connect()}>
            <RiWalletLine className="size-3.5" />
            Connect wallet
          </Button>
        )}

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
