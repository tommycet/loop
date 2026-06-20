import { describe, expect, it } from "vitest";

import { resolveRefs } from "../src/lib/tools";
import type { ToolCall } from "../src/types";

describe("resolveRefs", () => {
  it("maps *_ref args to *_id using previously created refs", () => {
    const refs = new Map<string, string>([["task_1", "uuid-123"]]);
    const call: ToolCall = {
      tool: "assign_owner",
      args: {
        task_ref: "task_1",
        team: "sales",
      },
    };

    expect(resolveRefs(call, refs)).toEqual({
      tool: "assign_owner",
      args: {
        task_id: "uuid-123",
        team: "sales",
      },
    });
  });

  it("throws when a referenced ref is missing", () => {
    const call: ToolCall = {
      tool: "assign_owner",
      args: {
        task_ref: "missing",
      },
    };

    expect(() => resolveRefs(call, new Map())).toThrow("Unresolved ref: missing");
  });
});
