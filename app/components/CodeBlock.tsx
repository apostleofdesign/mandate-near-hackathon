"use client";

import { useState } from "react";
import { RiClipboardLine, RiCheckLine } from "@remixicon/react";

// Minimal hand-rolled highlighter — no dependency, just enough to read as
// code: comments dimmed, strings amber, a few keywords in blue, numbers
// green. Escapes HTML first so this is safe against anything in `code`.
const TOKEN_RE =
  /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(const|let|var|await|async|function|import|from|return|export|new|type|near|call|view)\b|\b(\d[\d_]*n?)\b/g;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(line: string): string {
  const escaped = escapeHtml(line);
  return escaped.replace(TOKEN_RE, (match, comment, string, keyword, number) => {
    if (comment) return `<span class="text-zinc-500">${comment}</span>`;
    if (string) return `<span class="text-amber-300">${string}</span>`;
    if (keyword) return `<span class="text-sky-400">${keyword}</span>`;
    if (number) return `<span class="text-emerald-300">${number}</span>`;
    return match;
  });
}

// Renders as a bare terminal snippet — the surrounding page supplies the
// window chrome (title bar, traffic lights) once, not per block.
export default function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const lines = code.split("\n");
  const isShell = lang === "bash";

  return (
    <div className="group relative overflow-hidden rounded-md border border-zinc-800 bg-black/40">
      {lang && (
        <div className="flex items-center justify-between border-b border-zinc-800/80 px-3 py-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">{lang}</span>
          <button
            onClick={copy}
            aria-label="Copy code"
            className="flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-300"
          >
            {copied ? (
              <>
                <RiCheckLine className="size-3" />
                copied
              </>
            ) : (
              <>
                <RiClipboardLine className="size-3" />
                copy
              </>
            )}
          </button>
        </div>
      )}
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-zinc-200">
        <code>
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              {isShell && line.trim() !== "" && !/^\s/.test(line) ? (
                <span className="shrink-0 select-none text-emerald-500">$</span>
              ) : isShell ? (
                <span className="shrink-0 select-none opacity-0">$</span>
              ) : null}
              <span
                className="whitespace-pre"
                dangerouslySetInnerHTML={{ __html: highlight(line) || " " }}
              />
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
