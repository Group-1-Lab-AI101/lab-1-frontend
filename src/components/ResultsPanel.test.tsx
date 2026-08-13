import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ResultsPanel from "./ResultsPanel";
import {
  bootstrapFixture,
  multiPayloadFixture,
  searchPayloadFixture,
  stepFixture,
} from "../test/fixtures";

const baseProps = {
  bootstrap: bootstrapFixture,
  searchPayload: null,
  multiPayload: null,
  comparison: null,
  selectedCompare: null,
  onSelectCompare: vi.fn(),
  steps: [],
  stepIndex: 0,
  playing: false,
  onPlayingChange: vi.fn(),
  onStepIndexChange: vi.fn(),
};

describe("ResultsPanel", () => {
  it("labels an unsuccessful search as no path found", () => {
    render(<ResultsPanel {...baseProps} searchPayload={searchPayloadFixture("dijkstra", false)} />);
    expect(screen.getByText("No path found")).toBeInTheDocument();
    expect(screen.queryByText("Path found")).not.toBeInTheDocument();
  });

  it("shows live trace steps before a final search payload exists", () => {
    render(<ResultsPanel {...baseProps} steps={[stepFixture]} />);
    expect(screen.getByText("Search trace")).toBeInTheDocument();
    expect(screen.getByText("expand")).toBeInTheDocument();
  });

  it("does not expose the graph node path in the path-found block", () => {
    render(<ResultsPanel {...baseProps} searchPayload={searchPayloadFixture()} />);
    expect(screen.getByText("Path found")).toBeInTheDocument();
    expect(screen.queryByText("Graph node path")).not.toBeInTheDocument();
  });

  it("explains truncated frontier rendering and traced runtime", () => {
    const truncatedStep = {
      ...stepFixture,
      details: { ...stepFixture.details, frontier_count: 140 },
    };
    render(
      <ResultsPanel
        {...baseProps}
        searchPayload={searchPayloadFixture("astar")}
        steps={[truncatedStep]}
      />,
    );
    expect(screen.getByText("Runtime + trace")).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 140 frontier nodes on the map.")).toBeInTheDocument();
  });

  it("shows fixed-end and route-closure constraints for multi routes", () => {
    const { rerender } = render(
      <ResultsPanel {...baseProps} multiPayload={multiPayloadFixture()} />,
    );
    expect(screen.getByText("End rule")).toBeInTheDocument();
    expect(screen.getByText("Fixed: Saigon Zoo")).toBeInTheDocument();
    expect(screen.getAllByText("Saigon Zoo").length).toBeGreaterThan(0);
    expect(screen.getByText(/fixed end/)).toBeInTheDocument();
    expect(screen.getByText("Open route")).toBeInTheDocument();

    rerender(
      <ResultsPanel {...baseProps} multiPayload={multiPayloadFixture(null, true)} />,
    );
    expect(screen.getByText("Closed loop")).toBeInTheDocument();
    expect(screen.getAllByText("Start: Notre Dame Cathedral").length).toBeGreaterThan(0);
  });

  it("humanizes multi-route method and optimality labels", () => {
    const payload = multiPayloadFixture(null, false);
    payload.explanation.optimality_note = "approximate_not_guaranteed";
    render(<ResultsPanel {...baseProps} multiPayload={payload} />);
    expect(screen.getByText("Nearest Neighbor (approximate)")).toBeInTheDocument();
    expect(screen.getByText(/Approximate route/)).toBeInTheDocument();
    expect(screen.queryByText("approximate_not_guaranteed")).not.toBeInTheDocument();
    expect(screen.getByText("Selected waypoints")).toBeInTheDocument();
  });
});
