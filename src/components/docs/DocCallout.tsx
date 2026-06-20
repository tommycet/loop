"use client";

import Link from "next/link";

export function DocCallout({ kind = "info", children }: { kind?: "info" | "warn" | "tip"; children: React.ReactNode }) {
  const colors = {
    info: { border: "var(--brand-cyan)", bg: "var(--brand-cyan-soft)" },
    warn: { border: "var(--signal-warn)", bg: "oklch(0.78 0.16 80 / 0.15)" },
    tip: { border: "var(--signal-success)", bg: "oklch(0.74 0.18 150 / 0.15)" },
  }[kind];

  return (
    <aside
      className="my-6 rounded-lg p-5"
      style={{
        borderLeft: `3px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      <div className="font-mono text-[0.6875rem] tracking-[0.12em] uppercase mb-2 opacity-80">
        {kind}
      </div>
      <div className="text-[0.9375rem] text-fg-secondary leading-relaxed">{children}</div>
    </aside>
  );
}

export function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-[color:var(--ink-edge)]">
      <table className="w-full text-[0.875rem]">
        <thead className="bg-[color:var(--ink-deep)]">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-[color:var(--ink-edge)] px-4 py-3 text-left font-mono text-[0.6875rem] tracking-[0.12em] uppercase font-medium text-fg-tertiary"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[color:var(--ink-edge)] last:border-0 hover:bg-[color:var(--ink-raised)] transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-fg-secondary font-mono">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}