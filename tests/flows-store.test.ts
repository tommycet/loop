// Tests for the flow store + API routes. Uses FORCE_DEMO_MODE so all
// reads/writes hit the demo JSON file at .demo-state/loop-flows.json.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpDir: string;

beforeAll(() => {
  // Override cwd to a temp dir so we don't pollute the real demo state.
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-flows-test-"));
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir("/root/loop");
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

describe("flow store (demo mode)", () => {
  it("returns an empty list when no flows exist", async () => {
    const { listFlowsAsync } = await import("@/lib/flows/store");
    const flows = await listFlowsAsync();
    expect(flows).toEqual([]);
  });

  it("round-trips a flow through saveFlow/getFlow/listFlows/deleteFlow", async () => {
    const { saveFlow, getFlow, listFlowsAsync, deleteFlow } = await import("@/lib/flows/store");
    const { buildFlow, exampleFlows } = await import("@/lib/flows/executor");
    const flow = buildFlow({
      name: "test-discount",
      nodes: [{ id: "t1", kind: "trigger", type: "discount_offered", config: {} }],
      edges: [],
    });
    await saveFlow(flow);
    const fetched = await getFlow(flow.id);
    expect(fetched?.id).toBe(flow.id);
    expect(fetched?.name).toBe("test-discount");
    const all = await listFlowsAsync();
    expect(all.find((f) => f.id === flow.id)).toBeDefined();
    const removed = await deleteFlow(flow.id);
    expect(removed).toBe(true);
    const after = await getFlow(flow.id);
    expect(after).toBeNull();
  });

  it("updates updated_at on saveFlow when called twice", async () => {
    const { saveFlow, getFlow } = await import("@/lib/flows/store");
    const { buildFlow } = await import("@/lib/flows/executor");
    const flow = buildFlow({ name: "ts", nodes: [], edges: [] });
    await saveFlow(flow);
    const first = await getFlow(flow.id);
    // wait a few ms
    await new Promise((r) => setTimeout(r, 10));
    await saveFlow({ ...flow, name: "ts-updated" });
    const second = await getFlow(flow.id);
    expect(second?.name).toBe("ts-updated");
    expect(second?.updated_at >= first!.updated_at).toBe(true);
  });
});