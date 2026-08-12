import type { SearchStep } from "./types";

/**
 * Return the selected trace step with every node visited up to that point.
 *
 * WebSocket steps carry only the newly expanded node in `visited_delta`.
 * Rebuilding the unique history on the client keeps the protocol linear in the
 * number of expansions and supports both forward and backward trace replay.
 * Full `visited` snapshots remain a fallback for REST traces and old fixtures.
 */
export const stepWithVisitedHistory = (
  steps: SearchStep[],
  index: number,
): SearchStep | null => {
  if (!steps.length) return null;

  const safeIndex = Math.max(0, Math.min(index, steps.length - 1));
  const visited: string[] = [];
  const seen = new Set<string>();

  for (let stepIndex = 0; stepIndex <= safeIndex; stepIndex += 1) {
    const step = steps[stepIndex];
    const candidates = step.visited_delta?.length
      ? step.visited_delta
      : step.event === "expand" && step.current_node
        ? [step.current_node]
        : step.visited;
    for (const node of candidates) {
      if (seen.has(node)) continue;
      seen.add(node);
      visited.push(node);
    }
  }

  return { ...steps[safeIndex], visited };
};
