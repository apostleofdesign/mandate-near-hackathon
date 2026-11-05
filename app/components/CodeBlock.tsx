"use client";

import { useState } from "react";
import { RiClipboardLine, RiCheckLine } from "@remixicon/react";

export default function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/40">
      {lang && (
        <div className="border-b px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed"><code>{code}</code></pre>
      <button
        onClick={copy}
        aria-label="Copy code"
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
      >
        {copied ? <RiCheckLine className="size-3.5" /> : <RiClipboardLine className="size-3.5" />}
      </button>
    </div>
  );
}
