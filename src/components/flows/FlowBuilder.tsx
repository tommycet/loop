"use client";

// Flow Builder page — drag-drop React Flow canvas for admins.
// Loads existing flows from /api/flows, lets users create new ones from
// templates, edit nodes/edges inline, and save to the store.
//
// Visual style follows the rest of the app: dark, evidence-instrument, sober.
// React Flow's CSS is imported globally via globals.css (added separately).

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type {
  Flow,
  FlowNode,
  FlowEdge as FEdge,
  FlowNodeKind,
  FlowTriggerType,
  FlowConditionType,
  FlowActionType,
} from "@/types/flow";
import { exampleFlows } from "@/lib/flows/executor";

interface RFNodeData extends Record<string, unknown> {
  kind: FlowNodeKind;
  flowType: FlowTriggerType | FlowConditionType | FlowActionType;
  config: Record<string, unknown>;
  label: string;
}

type RFNode = Node<RFNodeData>;
type RFEdge = Edge;

const KIND_COLOR: Record<FlowNodeKind, string> = {
  trigger: "#10b981", // emerald
  condition: "#f59e0b", // amber
  action: "#3b82f6", // blue
};

function FlowBuilderInner() {
  const reactFlow = useReactFlow();
  const [nodes, setNodes] = useState<RFNode[]>([]);
  const [edges, setEdges] = useState<RFEdge[]>([]);
  const [flowName, setFlowName] = useState("New flow");
  const [flowId, setFlowId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedFlows, setSelectedFlows] = useState<Flow[]>([]);
  const [runResult, setRunResult] = useState<unknown>(null);

  // Load existing flows on mount.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/flows", { cache: "no-store" });
        if (!res.ok) throw new Error(`load failed: ${res.status}`);
        const data = await res.json();
        setSelectedFlows(data.flows || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange<RFNode>[]) => setNodes((nds) => applyNodeChanges(changes, nds) as RFNode[]),
    []
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange<RFEdge>[]) => setEdges((eds) => applyEdgeChanges(changes, eds) as RFEdge[]),
    []
  );
  const onConnect = useCallback(
    (conn: Connection) => {
      setEdges((eds) => [
        ...eds,
        { id: `e-${Date.now()}`, source: conn.source!, target: conn.target!, animated: true },
      ]);
    },
    []
  );

  const loadTemplate = (template: "discountApproval" | "deliveryPromiseStockCheck" | "repeatComplaintEscalation") => {
    const tpl =
      template === "discountApproval"
        ? exampleFlows.discountApproval(15)
        : template === "deliveryPromiseStockCheck"
        ? exampleFlows.deliveryPromiseStockCheck()
        : exampleFlows.repeatComplaintEscalation();
    setFlowName(tpl.name);
    setFlowId(null);
    hydrateFromFlow(tpl);
  };

  const loadFlow = (flow: Flow) => {
    setFlowName(flow.name);
    setFlowId(flow.id);
    hydrateFromFlow(flow);
  };

  const hydrateFromFlow = (flow: Flow) => {
    const rfNodes: RFNode[] = flow.nodes.map((n) => ({
      id: n.id,
      type: "default",
      position: n.position || { x: 0, y: 0 },
      data: {
        kind: n.kind,
        flowType: n.type,
        config: n.config,
        label: `${n.kind.toUpperCase()}: ${n.type}`,
      },
      style: {
        background: "#0a0a0a",
        color: KIND_COLOR[n.kind],
        border: `1px solid ${KIND_COLOR[n.kind]}`,
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        padding: 8,
        letterSpacing: "0.05em",
        minWidth: 180,
      },
    }));
    const rfEdges: RFEdge[] = flow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.branch === "true" ? "TRUE" : e.branch === "false" ? "FALSE" : undefined,
      animated: true,
      style: { stroke: e.branch === "true" ? "#10b981" : e.branch === "false" ? "#ef4444" : "#666" },
      labelStyle: { fontSize: 9, fill: e.branch === "true" ? "#10b981" : e.branch === "false" ? "#ef4444" : "#999", fontFamily: "ui-monospace" },
    }));
    setNodes(rfNodes);
    setEdges(rfEdges);
    setSavedAt(flow.updated_at);
  };

  const addNode = (kind: FlowNodeKind, flowType: FlowTriggerType | FlowConditionType | FlowActionType) => {
    const id = `${kind[0]}${Math.random().toString(36).slice(2, 6)}`;
    const position = { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 };
    const newNode: RFNode = {
      id,
      type: "default",
      position,
      data: { kind, flowType, config: {}, label: `${kind.toUpperCase()}: ${flowType}` },
      style: {
        background: "#0a0a0a",
        color: KIND_COLOR[kind],
        border: `1px solid ${KIND_COLOR[kind]}`,
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        padding: 8,
        letterSpacing: "0.05em",
        minWidth: 180,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const saveFlow = async () => {
    setBusy(true);
    setError(null);
    try {
      const flow: Flow = {
        id: flowId || `flow-${Math.random().toString(36).slice(2, 10)}`,
        name: flowName,
        enabled: true,
        nodes: nodes.map<FlowNode>((n) => ({
          id: n.id,
          kind: n.data.kind,
          type: n.data.flowType,
          config: n.data.config,
          position: n.position,
        })),
        edges: edges.map<FEdge>((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          branch: (e.label === "TRUE" ? "true" : e.label === "FALSE" ? "false" : undefined),
        })),
        created_at: savedAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const url = flowId ? `/api/flows/${flowId}` : "/api/flows";
      const method = flowId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(flow),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `save failed: ${res.status}`);
      }
      const data = await res.json();
      setFlowId(data.flow.id);
      setSavedAt(data.flow.updated_at);
      // Refresh list.
      const list = await fetch("/api/flows").then((r) => r.json());
      setSelectedFlows(list.flows || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/flows/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: {
            type: "commitment",
            payload: { commitment_type: "discount_offer", discount_pct: 25, risk_tier: "high" },
          },
        }),
      });
      const data = await res.json();
      setRunResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const fitView = () => reactFlow.fitView({ padding: 0.2 });

  const palette = useMemo(
    () => ({
      trigger: [
        { type: "commitment_detected" as const, label: "Commitment Detected" },
        { type: "discount_offered" as const, label: "Discount Offered" },
        { type: "delivery_promise_made" as const, label: "Delivery Promise" },
        { type: "payment_claimed" as const, label: "Payment Claimed" },
        { type: "complaint_received" as const, label: "Complaint Received" },
      ],
      condition: [
        { type: "risk_is_high" as const, label: "Risk = High" },
        { type: "discount_above_threshold" as const, label: "Discount > X%" },
        { type: "customer_is_repeat" as const, label: "Customer is Repeat" },
      ],
      action: [
        { type: "route_to_role" as const, label: "Route to Role" },
        { type: "send_notification" as const, label: "Send Notification" },
        { type: "lock_action" as const, label: "Lock Action" },
        { type: "log_to_audit" as const, label: "Log to Audit" },
        { type: "create_commitment" as const, label: "Create Commitment" },
        { type: "escalate" as const, label: "Escalate" },
      ],
    }),
    []
  );

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* LEFT: palette + templates + saved flows */}
      <aside className="w-72 shrink-0 overflow-y-auto border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs">
        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-emerald-400">Templates</h2>
        <div className="mb-6 flex flex-col gap-2">
          <button
            onClick={() => loadTemplate("discountApproval")}
            className="border border-emerald-900 bg-neutral-900 px-2 py-1.5 text-left text-emerald-300 hover:bg-emerald-950"
          >
            Discount Approval
          </button>
          <button
            onClick={() => loadTemplate("deliveryPromiseStockCheck")}
            className="border border-emerald-900 bg-neutral-900 px-2 py-1.5 text-left text-emerald-300 hover:bg-emerald-950"
          >
            Delivery Stock Check
          </button>
          <button
            onClick={() => loadTemplate("repeatComplaintEscalation")}
            className="border border-emerald-900 bg-neutral-900 px-2 py-1.5 text-left text-emerald-300 hover:bg-emerald-950"
          >
            Repeat Complaint Escalation
          </button>
        </div>

        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-emerald-400">Trigger Nodes</h2>
        <div className="mb-4 flex flex-col gap-1">
          {palette.trigger.map((p) => (
            <button
              key={p.type}
              onClick={() => addNode("trigger", p.type)}
              className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-left text-neutral-300 hover:border-emerald-700 hover:text-emerald-300"
            >
              {p.label}
            </button>
          ))}
        </div>

        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-amber-400">Condition Nodes</h2>
        <div className="mb-4 flex flex-col gap-1">
          {palette.condition.map((p) => (
            <button
              key={p.type}
              onClick={() => addNode("condition", p.type)}
              className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-left text-neutral-300 hover:border-amber-700 hover:text-amber-300"
            >
              {p.label}
            </button>
          ))}
        </div>

        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-blue-400">Action Nodes</h2>
        <div className="mb-6 flex flex-col gap-1">
          {palette.action.map((p) => (
            <button
              key={p.type}
              onClick={() => addNode("action", p.type)}
              className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-left text-neutral-300 hover:border-blue-700 hover:text-blue-300"
            >
              {p.label}
            </button>
          ))}
        </div>

        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-neutral-400">Saved Flows</h2>
        <div className="flex flex-col gap-1">
          {selectedFlows.length === 0 && (
            <span className="text-neutral-600">No flows yet</span>
          )}
          {selectedFlows.map((f) => (
            <button
              key={f.id}
              onClick={() => loadFlow(f)}
              className="border border-neutral-700 bg-neutral-900 px-2 py-1 text-left text-neutral-300 hover:border-neutral-500"
            >
              {f.name}
              <span className="ml-2 text-[9px] text-neutral-500">
                {new Date(f.updated_at).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* CENTER: canvas */}
      <main className="flex flex-1 flex-col border border-neutral-800 bg-neutral-950">
        <div className="flex items-center gap-3 border-b border-neutral-800 bg-neutral-900 p-3">
          <input
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            placeholder="Flow name"
            className="flex-1 border border-neutral-700 bg-black px-2 py-1 font-mono text-xs text-neutral-200 focus:border-emerald-700 focus:outline-none"
          />
          <button
            onClick={saveFlow}
            disabled={busy}
            className="bg-emerald-700 px-3 py-1 text-xs text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {flowId ? "Update" : "Save"}
          </button>
          <button
            onClick={runTest}
            disabled={busy}
            className="border border-amber-700 bg-neutral-900 px-3 py-1 text-xs text-amber-300 hover:bg-amber-950 disabled:opacity-50"
          >
            Test Run
          </button>
          <button
            onClick={fitView}
            className="border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
          >
            Fit
          </button>
        </div>

        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            colorMode="dark"
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#222" gap={20} />
            <Controls className="!bg-neutral-900 !text-neutral-300" />
            <MiniMap className="!bg-neutral-900" nodeColor={(n) => {
              const data = n.data as RFNodeData | undefined;
              return data ? KIND_COLOR[data.kind] : "#666";
            }} />
          </ReactFlow>
        </div>

        <div className="border-t border-neutral-800 bg-neutral-900 p-3 font-mono text-[10px] text-neutral-500">
          {error ? <span className="text-red-400">ERR: {error}</span> :
            savedAt ? <span>SAVED at {new Date(savedAt).toLocaleTimeString()}</span> :
            <span>UNSAVED</span>}
          <span className="ml-4">{nodes.length} nodes / {edges.length} edges</span>
        </div>
      </main>

      {/* RIGHT: test result panel */}
      <aside className="w-80 shrink-0 overflow-y-auto border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs">
        <h2 className="mb-3 text-[10px] uppercase tracking-widest text-neutral-400">Test Result</h2>
        {!runResult ? (
          <span className="text-neutral-600">Run a test to see output</span>
        ) : (
          <pre className="overflow-auto whitespace-pre-wrap break-all text-[10px] text-neutral-300">
            {JSON.stringify(runResult, null, 2)}
          </pre>
        )}
      </aside>
    </div>
  );
}

export function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner />
    </ReactFlowProvider>
  );
}