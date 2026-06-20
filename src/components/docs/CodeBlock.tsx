"use client";

import { useState } from "react";

export function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-6 overflow-hidden rounded-lg border border-[color:var(--ink-edge)] bg-[color:var(--ink-deep)]">
      <div className="flex items-center justify-between border-b border-[color:var(--ink-edge)] px-4 py-2">
        <span className="font-mono text-[0.6875rem] tracking-[0.12em] uppercase text-fg-muted">
          {language}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="font-mono text-[0.6875rem] tracking-[0.12em] uppercase text-fg-tertiary transition-colors hover:text-[color:var(--brand-cyan)]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[0.8125rem] leading-relaxed text-fg-secondary">
        <code>{code}</code>
      </pre>
    </div>
  );
}