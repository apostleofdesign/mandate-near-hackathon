"use client";

// Scroll-spy for the /developers sidebar: highlights whichever section is
// currently under the reading line, not just on hover — so scrolling alone
// tells you where you are, the way the terminal window itself implies you're
// moving through one continuous file.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "#quickstart", label: "Quickstart" },
  { href: "#pattern", label: "The pattern" },
  { href: "#typescript", label: "TypeScript" },
  { href: "#cli", label: "near-cli" },
  { href: "#reference", label: "Contract reference" },
];

export default function DevNav() {
  const [active, setActive] = useState(SECTIONS[0].href);

  useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.href.slice(1))).filter(
      (el): el is HTMLElement => el !== null
    );
    if (elements.length === 0) return;

    // A band near the top of the viewport counts as "current" — whichever
    // observed section is highest inside it wins, so exactly one link is lit
    // at a time instead of flickering between neighbors.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        setActive(`#${topMost.target.id}`);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="hidden lg:sticky lg:top-20 lg:block lg:h-fit">
      <ul className="flex flex-col gap-1 border-l text-sm">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              className={cn(
                "-ml-px block border-l-2 px-3 py-1 transition-colors",
                active === s.href
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
