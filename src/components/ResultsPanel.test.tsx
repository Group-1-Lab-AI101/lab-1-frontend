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

  it("shows fixed-end and route-closure constraints for multi routes", () => {
    const { rerender } = render(
      <ResultsPanel {...baseProps} multiPayload={multiPayloadFixture()} />,
    );
    expect(screen.getByText("Fixed end")).toBeInTheDocument();
    expect(screen.getAllByText("Saigon Zoo").length).toBeGreaterThan(0);
    expect(screen.getByText("Open route")).toBeInTheDocument();

    rerender(
      <ResultsPanel {...baseProps} multiPayload={multiPayloadFixture(null, true)} />,
    );
    expect(screen.getByText("Return to start")).toBeInTheDocument();
  });
});
