import { describe, expect, it } from "vitest";
import {
  MINIMAL_BASEMAP_URL,
  routeConditionColor,
  routeConditionSeverity,
  routeRenderKey,
} from "./MapView";
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

  it("uses a muted basemap with road and place labels", () => {
    expect(MINIMAL_BASEMAP_URL).toContain("light_all");
  });

  it("maps low conditions toward green and severe conditions toward red", () => {
    const low = { congestion: 1, risk: 0 };
    const high = { congestion: 5, risk: 2.2 };
    expect(routeConditionSeverity(low)).toBe(0);
    expect(routeConditionSeverity(high)).toBe(1);
    expect(routeConditionColor(low)).toContain("hsl(120.0");
    expect(routeConditionColor(high)).toContain("hsl(0.0");
  });
});
