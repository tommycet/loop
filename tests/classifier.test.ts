import { describe, expect, it } from "vitest";

import { hasActionSignal, isNoise } from "../src/lib/classifier";

describe("classifier helpers", () => {
  it("marks acknowledgements as noise", () => {
    expect(isNoise("ok")).toBe(true);
    expect(isNoise("thanks")).toBe(true);
    expect(isNoise("👍")).toBe(true);
  });

  it("detects action-oriented language", () => {
    expect(hasActionSignal("send the quote by Friday")).toBe(true);
    expect(hasActionSignal("got it")).toBe(false);
  });
});
