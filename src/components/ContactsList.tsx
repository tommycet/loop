"use client";

import { useEffect, useState } from "react";

type Contact = {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export function ContactsList({ refreshKey }: { refreshKey: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch("/api/contacts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setContacts(Array.isArray(d) ? d : []))
      .catch(() => setContacts([]));
  }, [refreshKey]);

  const filtered = contacts.filter((c) => {
    const q = filter.toLowerCase();
    return (
      !q ||
      (c.name || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <section className="rounded-[2rem] border border-white/10 bg-[#0c0f17] p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.32em] text-cyan-300/70">people</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Contacts</h2>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="Search name, phone, email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-72 rounded-full border border-[color:var(--ink-edge)] bg-[color:var(--ink-base)] px-4 py-2 text-sm text-fg-primary focus:border-[color:var(--brand-cyan)] focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.04] text-[10px] uppercase tracking-[0.18em] text-white/45">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-white/45">
                  No contacts yet.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">{c.name || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{c.phone || "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-white/70">{c.email || "—"}</td>
                  <td className="px-4 py-3 text-xs text-white/45">
                    {String((c.metadata as Record<string, unknown>)?.source || "—")}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/45">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}