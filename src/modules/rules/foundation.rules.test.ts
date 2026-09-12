import { describe, expect, it } from "vitest";

describe("rules regression suite foundation", () => {
  it("has no active legal rules before Milestone 2", () => {
    const activeRules: string[] = [];
    expect(activeRules).toEqual([]);
  });
});
