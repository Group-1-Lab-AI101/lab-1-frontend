import type {
  Bootstrap,
  Landmark,
  MultiPayload,
  SearchPayload,
  SearchStep,
} from "../types";

const landmark = (id: string, name: string, index: number): Landmark => ({
  id,
  name,
  category: "landmark",
  description: name,
  latitude: 10.77 + index * 0.001,
  longitude: 106.69 + index * 0.001,
  snapped_node: `node-${index}`,
  snapped_distance_m: 5,
});

export const landmarks = [
  landmark("notre_dame_cathedral", "Notre Dame Cathedral", 0),
  landmark("saigon_zoo", "Saigon Zoo", 1),
  landmark("ben_thanh_market", "Ben Thanh Market", 2),
  landmark("nguyen_hue_walking_street", "Nguyen Hue Walking Street", 3),
  landmark("bach_dang_wharf", "Bach Dang Wharf", 4),
  landmark("fine_arts_museum", "Fine Arts Museum", 5),
];

export const bootstrapFixture: Bootstrap = {
  landmarks,
  algorithms: {
    dijkstra: { label: "Dijkstra", description: "Cost-aware", guarantee: "Optimal" },
    greedy: { label: "Greedy Best-First", description: "Heuristic", guarantee: "Approximate" },
  },
  cost_presets: { balanced: {}, fastest: {} },
  traffic_profiles: { normal: "Normal", rush_hour: "Rush hour" },
  network_summary: { routable_nodes: 10, routable_edges: 20 },
  node_coordinates: Object.fromEntries(
    landmarks.map((item, index) => [item.snapped_node, [item.latitude, item.longitude] as [number, number]]),
  ),
  boundary: {},
};

export const stepFixture: SearchStep = {
  index: 0,
  event: "expand",
  current_node: "node-0",
  frontier: [{ node: "node-1", priority: 1 }],
  visited: ["node-0"],
  details: { g: 0, h: 1, f: 1 },
};

export const searchPayloadFixture = (
  algorithm = "dijkstra",
  success = true,
): SearchPayload => ({
  request: {
    start: landmarks[0],
    goal: landmarks[1],
    algorithm,
    criterion: "balanced",
    traffic_profile: "normal",
    weights: {},
  },
  result: {
    algorithm,
    success,
    start: landmarks[0].id,
    goal: landmarks[1].id,
    path: success ? ["node-0", "node-1"] : [],
    total_cost: success ? 1 : null,
    total_distance_km: success ? 1 : null,
    total_time_min: success ? 2 : null,
    visited_order: ["node-0"],
    expanded_nodes: 1,
    generated_nodes: 2,
    runtime_ms: 0.5,
    trace: [],
    message: success ? "ok" : "unreachable",
    optimality: success ? "optimal" : "not_applicable",
  },
  route_geojson: {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: success
        ? [[106.69, 10.77], [106.691, 10.771], [algorithm === "greedy" ? 106.7 : 106.692, 10.772]]
        : [],
    },
  },
  route_segments: [],
  alternative: null,
  explanation: {
    headline: success ? "Route available" : "No route available for this request.",
    reasons: [],
    optimality_note: success ? "Optimal" : "No path",
  },
});

export const multiPayloadFixture = (
  end: Landmark | null = landmarks[1],
  returnToStart = false,
): MultiPayload => ({
  request: {
    start: landmarks[0],
    waypoints: [landmarks[2]],
    end,
    method: "nearest_neighbor",
    return_to_start: returnToStart,
    criterion: "balanced",
    traffic_profile: "normal",
    weights: {},
  },
  result: {
    method: "nearest_neighbor",
    success: true,
    visiting_order: [landmarks[0].id, landmarks[2].id, end?.id ?? landmarks[0].id],
    full_path: ["node-0", "node-2", "node-1"],
    total_cost: 2,
    total_distance_km: 2,
    total_time_min: 4,
    runtime_ms: 1,
    optimality: "approximate",
    comparison_gap_percent: null,
    message: "ok",
  },
  visiting_landmarks: [landmarks[0], landmarks[2], end ?? landmarks[0]],
  route_geojson: {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: [[106.69, 10.77], [106.692, 10.772]] },
  },
  comparison: null,
  explanation: {
    headline: "Route optimized",
    optimality_note: "Approximate",
    duplicate_policy: "deduplicated",
  },
});
