import { describe, expect, it } from "vitest";
import type { SearchStep } from "./types";
import { stepWithVisitedHistory } from "./trace";

const step = (index: number, node: string): SearchStep => ({
  index,
  event: "expand",
  current_node: node,
  frontier: [],
  visited: [],
  visited_delta: [node],
  details: { visited_count: index + 1 },
});

describe("stepWithVisitedHistory", () => {
  const steps = [
    step(0, "A"),
    step(1, "B"),
    step(2, "C"),
  ];

  it("keeps earlier visited nodes visible at later steps", () => {
    expect(stepWithVisitedHistory(steps, 2)?.visited).toEqual(["A", "B", "C"]);
  });

  it("restores the correct history when navigating backward", () => {
    expect(stepWithVisitedHistory(steps, 0)?.visited).toEqual(["A"]);
    expect(stepWithVisitedHistory(steps, 1)?.visited).toEqual(["A", "B"]);
  });

  it("still accepts a full visited snapshot from a non-WebSocket trace", () => {
    const snapshot: SearchStep = {
      ...step(0, "A"),
      event: "goal",
      current_node: null,
      visited_delta: undefined,
      visited: ["A", "B"],
    };
    expect(stepWithVisitedHistory([snapshot], 0)?.visited).toEqual(["A", "B"]);
  });
});
