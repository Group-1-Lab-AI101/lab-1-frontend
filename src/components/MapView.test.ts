import { describe, expect, it } from "vitest";
import { routeRenderKey } from "./MapView";
import type { GeoJsonFeature } from "../types";

const route = (lastLongitude: number): GeoJsonFeature => ({
  type: "Feature",
  properties: {},
  geometry: {
    type: "LineString",
    coordinates: [[106.69, 10.77], [106.691, 10.771], [lastLongitude, 10.772]],
  },
});

describe("routeRenderKey", () => {
  it("changes when later coordinates change even if the first two are identical", () => {
    expect(routeRenderKey(route(106.692))).not.toBe(routeRenderKey(route(106.7)));
  });
});
