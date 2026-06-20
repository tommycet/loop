import { describe, expect, it } from "vitest";

import { parsePlannerContent } from "../src/lib/planner-helpers";

describe("parsePlannerContent", () => {
  it("returns the plan array from planner JSON", () => {
    const content = JSON.stringify({
      plan: [
        { tool: "ignore", args: {} },
      ],
    });

    expect(parsePlannerContent(content)).toEqual([
      { tool: "ignore", args: {} },
    ]);
  });

  it("returns an empty plan when payload shape is wrong", () => {
    expect(parsePlannerContent(JSON.stringify({ nope: true }))).toEqual([]);
  });
});
