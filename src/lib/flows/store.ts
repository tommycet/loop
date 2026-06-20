// Flow storage layer. Uses demo-state JSON in FORCE_DEMO_MODE, Supabase in
// production. Persists flow graphs to the `flows` table — schema in
// supabase/migrations/003_flows.sql (created separately).
//
// Pattern follows src/lib/demo-state.ts: fs-based JSON file, with
// safeSupabase() for production reads/writes.

import type { Flow } from "@/types/flow";
import { safeSupabase } from "../runtime";
import fs from "node:fs";
import path from "node:path";

const STORE_FILE = path.join(process.cwd(), ".demo-state", "loop-flows.json");

interface FlowStore {
  flows: Flow[];
}

function readStore(): FlowStore {
  try {
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    return JSON.parse(raw) as FlowStore;
  } catch {
    return { flows: [] };
  }
}

function writeStore(store: FlowStore): void {
  fs.mkdirSync(path.dirname(STORE_FILE), { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

export function listFlows(): Flow[] {
  const sb = safeSupabase();
  if (sb) {
    // Async fetch path; caller can use `await listFlowsAsync` for production.
    // This sync fallback is for tools that need a quick synchronous snapshot.
    return [];
  }
  const store = readStore();
  return store.flows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function listFlowsAsync(): Promise<Flow[]> {
  const sb = safeSupabase();
  if (sb) {
    const { data, error } = await sb.from("flows").select("data").order("created_at", { ascending: false });
    if (error) throw new Error(`listFlows: ${error.message}`);
    return (data || []).map((row: { data: Flow }) => row.data);
  }
  const store = readStore();
  return store.flows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function getFlow(id: string): Promise<Flow | null> {
  const sb = safeSupabase();
  if (sb) {
    const { data, error } = await sb.from("flows").select("data").eq("id", id).maybeSingle();
    if (error) throw new Error(`getFlow: ${error.message}`);
    return data?.data ?? null;
  }
  const store = readStore();
  return store.flows.find((f) => f.id === id) ?? null;
}

export async function saveFlow(flow: Flow): Promise<Flow> {
  const updated: Flow = { ...flow, updated_at: new Date().toISOString() };
  const sb = safeSupabase();
  if (sb) {
    const { error } = await sb.from("flows").upsert({ id: flow.id, data: updated, name: flow.name, enabled: flow.enabled, updated_at: updated.updated_at });
    if (error) throw new Error(`saveFlow: ${error.message}`);
    return updated;
  }
  const store = readStore();
  const idx = store.flows.findIndex((f) => f.id === flow.id);
  if (idx >= 0) store.flows[idx] = updated;
  else store.flows.push(updated);
  writeStore(store);
  return updated;
}

export async function deleteFlow(id: string): Promise<boolean> {
  const sb = safeSupabase();
  if (sb) {
    const { error } = await sb.from("flows").delete().eq("id", id);
    if (error) throw new Error(`deleteFlow: ${error.message}`);
    return true;
  }
  const store = readStore();
  const before = store.flows.length;
  store.flows = store.flows.filter((f) => f.id !== id);
  writeStore(store);
  return store.flows.length < before;
}