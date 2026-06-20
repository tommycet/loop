"use client";

// Admin rule editor. Lists all authority rules with inline editing,
// a "test rule" form to paste a sample message, and save buttons.
// Strictly admin-only — page itself gates via /api/me.

import { useCallback, useEffect, useState } from "react";

interface AuthorityRule {
  id: string;
  action_type: string;
  required_role: string;
  max_auto_threshold_pct?: number | null;
  max_auto_threshold_hours?: number | null;
  fail_mode: "draft_only" | "block" | "escalate";
  description?: string | null;
}

interface TestResult {
  message: string;
  detected: { type: string; risk_tier: string; discount_pct?: number };
  rules: AuthorityRule[];
  suggested_role: string;
  summary: string;
}

export function AuthorityRulesEditor() {
  const [rules, setRules] = useState<AuthorityRule[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  // Test-rule state.
  const [testMessage, setTestMessage] = useState("I'll give Ahmed 25% off if he pays today");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/authority-rules", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setRules(Array.isArray(d) ? d : d.rules || []))
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateLocal = (id: string, patch: Partial<AuthorityRule>) => {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRule = async (rule: AuthorityRule) => {
    setBusy(true);
    setError(null);
    setSavedId(null);
    try {
      const res = await fetch("/api/authority-rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `save failed: ${res.status}`);
      }
      const data = await res.json();
      setSavedId(rule.id);
      // Replace with server-confirmed version.
      setRules((rs) => rs.map((r) => (r.id === rule.id ? data.rule : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setTestBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/authority-rules/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: testMessage }),
      });
      if (!res.ok) throw new Error(`test failed: ${res.status}`);
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTestBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-emerald-400">authority rules</div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
              Governance policy
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Edit thresholds and required roles. Changes apply on next commitment detection.
            </p>
          </div>
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                <th className="px-2 py-2">Action type</th>
                <th className="px-2 py-2">Required role</th>
                <th className="px-2 py-2">Threshold %</th>
                <th className="px-2 py-2">Threshold hours</th>
                <th className="px-2 py-2">Fail mode</th>
                <th className="px-2 py-2">Description</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 && (
                <tr><td colSpan={7} className="px-2 py-4 text-center text-neutral-600">No rules.</td></tr>
              )}
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-neutral-900 hover:bg-neutral-900/40">
                  <td className="px-2 py-2 text-emerald-300">{r.action_type}</td>
                  <td className="px-2 py-2">
                    <select
                      value={r.required_role}
                      onChange={(e) => updateLocal(r.id, { required_role: e.target.value })}
                      className="border border-neutral-700 bg-black px-1 py-0.5 text-neutral-200"
                    >
                      <option value="admin">admin</option>
                      <option value="operations">operations</option>
                      <option value="finance">finance</option>
                      <option value="sales">sales</option>
                      <option value="viewer">viewer</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={r.max_auto_threshold_pct ?? ""}
                      onChange={(e) => updateLocal(r.id, { max_auto_threshold_pct: e.target.value === "" ? null : Number(e.target.value) })}
                      className="w-16 border border-neutral-700 bg-black px-1 py-0.5 text-right text-neutral-200"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={r.max_auto_threshold_hours ?? ""}
                      onChange={(e) => updateLocal(r.id, { max_auto_threshold_hours: e.target.value === "" ? null : Number(e.target.value) })}
                      className="w-16 border border-neutral-700 bg-black px-1 py-0.5 text-right text-neutral-200"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={r.fail_mode}
                      onChange={(e) => updateLocal(r.id, { fail_mode: e.target.value as AuthorityRule["fail_mode"] })}
                      className="border border-neutral-700 bg-black px-1 py-0.5 text-neutral-200"
                    >
                      <option value="block">block</option>
                      <option value="draft_only">draft_only</option>
                      <option value="escalate">escalate</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={r.description ?? ""}
                      onChange={(e) => updateLocal(r.id, { description: e.target.value })}
                      className="w-full border border-neutral-700 bg-black px-1 py-0.5 text-neutral-300"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => saveRule(rules.find((x) => x.id === r.id) || r)}
                      disabled={busy}
                      className={`px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
                        savedId === r.id
                          ? "border border-emerald-600 bg-emerald-950 text-emerald-300"
                          : "border border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-emerald-700 hover:text-emerald-300"
                      }`}
                    >
                      {savedId === r.id ? "saved" : "save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
        <div className="mb-3 text-[10px] uppercase tracking-[0.32em] text-amber-400">test rule</div>
        <h3 className="mb-3 text-lg font-semibold text-white">Paste a sample message</h3>
        <div className="flex gap-3">
          <input
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            placeholder="e.g. I'll give Ahmed 25% off if he pays today"
            className="flex-1 border border-neutral-700 bg-black px-3 py-2 font-mono text-xs text-neutral-200 focus:border-amber-700 focus:outline-none"
          />
          <button
            onClick={runTest}
            disabled={testBusy || !testMessage}
            className="border border-amber-700 bg-neutral-900 px-4 py-2 text-xs uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-950 disabled:opacity-50"
          >
            {testBusy ? "testing..." : "test"}
          </button>
        </div>
        {testResult && (
          <div className="mt-4 rounded-xl border border-neutral-800 bg-black p-4 font-mono text-xs">
            <div className="mb-2 text-neutral-500">{testResult.summary}</div>
            <div className="grid grid-cols-3 gap-4 text-[10px] uppercase tracking-[0.18em]">
              <div>
                <div className="text-neutral-600">detected type</div>
                <div className="text-emerald-300">{testResult.detected.type}</div>
              </div>
              <div>
                <div className="text-neutral-600">risk tier</div>
                <div className="text-amber-300">{testResult.detected.risk_tier}</div>
              </div>
              <div>
                <div className="text-neutral-600">suggested role</div>
                <div className="text-blue-300">{testResult.suggested_role}</div>
              </div>
            </div>
            {testResult.rules.length > 0 && (
              <div className="mt-3 border-t border-neutral-800 pt-3">
                <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                  matching rules ({testResult.rules.length})
                </div>
                <ul className="space-y-1">
                  {testResult.rules.map((r) => (
                    <li key={r.id} className="text-neutral-300">
                      <span className="text-emerald-400">{r.action_type}</span>
                      {" → "}
                      <span className="text-blue-300">{r.required_role}</span>
                      {r.description ? <span className="text-neutral-600"> · {r.description}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}