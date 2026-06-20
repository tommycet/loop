// Integration tests for the flow API routes (POST /api/flows, GET, /run).
// Hits Next.js route handlers directly — no HTTP server needed.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loop-flows-api-"));
  process.chdir(tmpDir);
});

afterAll(() => {
  process.chdir("/root/loop");
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

function jsonRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

describe("flows API routes", () => {
  it("GET /api/flows returns empty list initially", async () => {
    const { GET } = await import("@/app/api/flows/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.flows).toEqual([]);
  });

  it("POST /api/flows creates a valid flow and returns 201", async () => {
    const { POST, GET } = await import("@/app/api/flows/route");
    const req = jsonRequest("http://localhost/api/flows", {
      method: "POST",
      body: JSON.stringify({
        name: "API test flow",
        nodes: [{ id: "t1", kind: "trigger", type: "discount_offered", config: {} }],
        edges: [],
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.flow.name).toBe("API test flow");
    expect(data.flow.id).toMatch(/^flow-/);
    // Should appear in list now.
    const list = await GET();
    const listData = await list.json();
    expect(listData.flows.length).toBe(1);
  });

  it("POST /api/flows rejects an invalid flow with 400", async () => {
    const { POST } = await import("@/app/api/flows/route");
    const req = jsonRequest("http://localhost/api/flows", {
      method: "POST",
      body: JSON.stringify({
        name: "no-trigger",
        // No triggers -> invalid.
        nodes: [{ id: "a1", kind: "action", type: "log_to_audit", config: {} }],
        edges: [],
      }),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("invalid flow");
    expect(data.details.some((e: string) => e.includes("trigger"))).toBe(true);
  });

  it("POST /api/flows rejects when name is missing with 400", async () => {
    const { POST } = await import("@/app/api/flows/route");
    const req = jsonRequest("http://localhost/api/flows", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("POST /api/flows/run evaluates enabled flows against an event", async () => {
    const { POST } = await import("@/app/api/flows/route");
    const { POST: RUN } = await import("@/app/api/flows/run/route");
    // Create a flow first.
    const createReq = jsonRequest("http://localhost/api/flows", {
      method: "POST",
      body: JSON.stringify({
        name: "high-discount-25",
        nodes: [
          { id: "t1", kind: "trigger", type: "discount_offered", config: {} },
          { id: "c1", kind: "condition", type: "discount_above_threshold", config: { threshold: 20 } },
          { id: "a1", kind: "action", type: "route_to_role", config: { role: "admin" } },
        ],
        edges: [
          { id: "e1", source: "t1", target: "c1" },
          { id: "e2", source: "c1", target: "a1", branch: "true" },
        ],
      }),
    });
    const createRes = await POST(createReq as unknown as import("next/server").NextRequest);
    const created = await createRes.json();
    // Now run it.
    const runReq = jsonRequest("http://localhost/api/flows/run", {
      method: "POST",
      body: JSON.stringify({
        event: { type: "commitment", payload: { commitment_type: "discount_offer", discount_pct: 30 } },
      }),
    });
    const runRes = await RUN(runReq as unknown as import("next/server").NextRequest);
    expect(runRes.status).toBe(200);
    const data = await runRes.json();
    expect(data.evaluated).toBeGreaterThan(0);
    const matched = data.results.find((r: { matched: boolean; flow_id: string }) => r.matched && r.flow_id === created.flow.id);
    expect(matched).toBeDefined();
    const routeAction = matched.actions.find((a: { action: string }) => a.action === "route_to_role");
    expect(routeAction).toBeDefined();
    expect(routeAction.result.role).toBe("admin");
  });

  it("POST /api/flows/run rejects missing event with 400", async () => {
    const { POST: RUN } = await import("@/app/api/flows/run/route");
    const req = jsonRequest("http://localhost/api/flows/run", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await RUN(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("GET /api/flows/[id] returns 404 for unknown flow", async () => {
    const { GET } = await import("@/app/api/flows/[id]/route");
    const res = await GET(
      new Request("http://localhost/api/flows/does-not-exist") as unknown as import("next/server").NextRequest,
      { params: { id: "does-not-exist" } }
    );
    expect(res.status).toBe(404);
  });

  it("DELETE /api/flows/[id] removes a flow", async () => {
    const { POST } = await import("@/app/api/flows/route");
    const { DELETE, GET } = await import("@/app/api/flows/[id]/route");
    // Create
    const createReq = jsonRequest("http://localhost/api/flows", {
      method: "POST",
      body: JSON.stringify({
        name: "to-delete",
        nodes: [{ id: "t1", kind: "trigger", type: "complaint_received", config: {} }],
        edges: [],
      }),
    });
    const createRes = await POST(createReq as unknown as import("next/server").NextRequest);
    const { flow } = await createRes.json();
    // Delete
    const delRes = await DELETE(
      new Request(`http://localhost/api/flows/${flow.id}`) as unknown as import("next/server").NextRequest,
      { params: { id: flow.id } }
    );
    expect(delRes.status).toBe(200);
    // Confirm gone
    const getRes = await GET(
      new Request(`http://localhost/api/flows/${flow.id}`) as unknown as import("next/server").NextRequest,
      { params: { id: flow.id } }
    );
    expect(getRes.status).toBe(404);
  });
});