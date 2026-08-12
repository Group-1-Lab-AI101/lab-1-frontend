import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import {
  compareRoutes,
  fetchBootstrap,
  fetchNetwork,
  optimizeMultiRoute,
  streamSearch,
} from "./api";
import {
  bootstrapFixture,
  multiPayloadFixture,
  searchPayloadFixture,
  stepFixture,
} from "./test/fixtures";
import type { GeoJsonFeature, Landmark, SearchPayload } from "./types";

vi.mock("./api", () => ({
  compareRoutes: vi.fn(),
  fetchBootstrap: vi.fn(),
  fetchNetwork: vi.fn(),
  optimizeMultiRoute: vi.fn(),
  streamSearch: vi.fn(),
}));

vi.mock("./components/MapView", () => ({
  default: ({ selectedLandmarks, route, colorRouteByConditions }: {
    selectedLandmarks: Landmark[];
    route: GeoJsonFeature | null;
    colorRouteByConditions: boolean;
  }) => (
    <div
      data-testid="map-view"
      data-landmarks={selectedLandmarks.map((item) => item.id).join(",")}
      data-route-points={route?.geometry.coordinates.length ?? 0}
      data-condition-colors={String(colorRouteByConditions)}
    />
  ),
}));

const mockedBootstrap = vi.mocked(fetchBootstrap);
const mockedNetwork = vi.mocked(fetchNetwork);
const mockedStream = vi.mocked(streamSearch);
const mockedCompare = vi.mocked(compareRoutes);
const mockedMulti = vi.mocked(optimizeMultiRoute);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const loadApp = async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Find route" });
};

describe("App request lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBootstrap.mockResolvedValue(bootstrapFixture);
    mockedNetwork.mockResolvedValue({ type: "FeatureCollection", features: [] });
    mockedStream.mockResolvedValue(searchPayloadFixture());
    mockedCompare.mockResolvedValue({
      request: searchPayloadFixture().request,
      algorithms: [searchPayloadFixture()],
      summary: { headline: "ok", leaders: {}, observations: [] },
    });
    mockedMulti.mockResolvedValue(multiPayloadFixture());
  });

  it("shows live steps and ignores a Single result after switching to Multi", async () => {
    const pending = deferred<SearchPayload>();
    mockedStream.mockImplementation(async (_request, onStep) => {
      onStep(stepFixture);
      return pending.promise;
    });
    await loadApp();

    fireEvent.click(screen.getByRole("button", { name: "Find route" }));
    expect(await screen.findByText("Search trace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Multi" }));
    pending.resolve(searchPayloadFixture());

    await waitFor(() => expect(screen.getByRole("tab", { name: "Multi" })).toHaveAttribute("aria-selected", "true"));
    expect(screen.queryByText("Path found")).not.toBeInTheDocument();
    expect(screen.queryByText("Search trace")).not.toBeInTheDocument();
  });

  it("clears completed output when a request control changes", async () => {
    await loadApp();
    fireEvent.click(screen.getByRole("button", { name: "Find route" }));
    expect(await screen.findByText("Path found")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "ben_thanh_market" } });
    expect(screen.queryByText("Path found")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Find route" }));
    expect(await screen.findByText("Path found")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "fastest" }));
    expect(screen.queryByText("Path found")).not.toBeInTheDocument();
  });

  it("replays a completed trace from the first step and reveals the route at the end", async () => {
    mockedStream.mockImplementation(async (_request, onStep) => {
      onStep(stepFixture);
      onStep({
        ...stepFixture,
        index: 1,
        current_node: "node-1",
        visited: ["node-0", "node-1"],
      });
      return searchPayloadFixture("astar");
    });
    await loadApp();

    fireEvent.click(screen.getByRole("button", { name: "Find route" }));
    expect(await screen.findByText("Path found")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByTestId("map-view")).toHaveAttribute("data-route-points", "0");

    fireEvent.click(screen.getByTitle("Next step"));
    expect(screen.getByTestId("map-view")).toHaveAttribute("data-route-points", "3");
  });

  it("offers the simplified basemap toggle by default", async () => {
    await loadApp();
    const toggle = screen.getByRole("button", { name: "Toggle minimal background map layer" });
    expect(toggle).toHaveTextContent("Minimal map On");
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("Minimal map Off");
  });

  it("clears a fixed end that becomes the Multi start", async () => {
    await loadApp();
    fireEvent.click(screen.getByRole("tab", { name: "Multi" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /End at a specific place/ }));
    const endSelect = screen.getByLabelText("Fixed end destination") as HTMLSelectElement;
    fireEvent.change(endSelect, { target: { value: "ben_thanh_market" } });
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "ben_thanh_market" } });
    expect(screen.queryByLabelText("Fixed end destination")).not.toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /End at a specific place/ })).not.toBeChecked();
  });

  it("moves a selected fixed end out of waypoints and sends no duplicate", async () => {
    await loadApp();
    fireEvent.click(screen.getByRole("tab", { name: "Multi" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /End at a specific place/ }));
    fireEvent.change(screen.getByLabelText("Fixed end destination"), { target: { value: "ben_thanh_market" } });

    expect(screen.queryByRole("checkbox", { name: "Ben Thanh Market" })).not.toBeInTheDocument();
    const selected = screen.getByTestId("map-view").getAttribute("data-landmarks")?.split(",") ?? [];
    expect(new Set(selected).size).toBe(selected.length);

    fireEvent.click(screen.getByRole("button", { name: "Optimize route" }));
    await waitFor(() => expect(mockedMulti).toHaveBeenCalled());
    const request = mockedMulti.mock.calls[0][0];
    expect(request.end).toBe("ben_thanh_market");
    expect(request.waypoints).not.toContain("ben_thanh_market");
  });

  it("toggles simulated traffic and risk coloring independently of route inputs", async () => {
    await loadApp();
    const checkbox = screen.getByRole("checkbox", { name: "Color route by traffic & risk" });
    expect(screen.getByTestId("map-view")).toHaveAttribute("data-condition-colors", "false");
    fireEvent.click(checkbox);
    expect(screen.getByTestId("map-view")).toHaveAttribute("data-condition-colors", "true");
    expect(screen.getByText(/not live traffic/i)).toBeInTheDocument();
  });

  it("offers Held-Karp and avoids the brute-force comparison for that method", async () => {
    await loadApp();
    fireEvent.click(screen.getByRole("tab", { name: "Multi" }));
    fireEvent.change(screen.getByLabelText("Method"), { target: { value: "held_karp" } });
    fireEvent.click(screen.getByRole("button", { name: "Optimize route" }));
    await waitFor(() => expect(mockedMulti).toHaveBeenCalled());
    expect(mockedMulti.mock.calls[0][0]).toMatchObject({
      method: "held_karp",
      compare_methods: false,
    });
  });

  it("keeps the app usable when the optional network overlay fails", async () => {
    mockedNetwork.mockRejectedValue(new Error("overlay offline"));
    await loadApp();
    expect(screen.getByRole("button", { name: "Find route" })).toBeEnabled();
    expect(await screen.findByText(/Road network overlay unavailable: overlay offline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry overlay" })).toBeInTheDocument();
  });
});
