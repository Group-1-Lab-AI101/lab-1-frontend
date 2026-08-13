export type Mode = "single" | "compare" | "multi";

export interface Landmark {
  id: string;
  name: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  routing_latitude: number;
  routing_longitude: number;
  access_kind: string;
  access_label: string;
  access_source: string;
  access_road: string;
  snapped_node: string;
  snapped_distance_m: number;
}

export interface AlgorithmMeta {
  label: string;
  description: string;
  guarantee: string;
}

export interface SearchStep {
  index: number;
  event: string;
  current_node: string | null;
  frontier: Array<{ node: string; priority: number }>;
  visited: string[];
  visited_delta?: string[];
  details: Record<string, unknown>;
}

export interface SearchResult {
  algorithm: string;
  success: boolean;
  start: string;
  goal: string;
  path: string[];
  total_cost: number | null;
  total_distance_km: number | null;
  total_time_min: number | null;
  visited_order: string[];
  expanded_nodes: number;
  generated_nodes: number;
  runtime_ms: number;
  trace: SearchStep[];
  message: string;
  optimality: string;
}

export interface Explanation {
  headline: string;
  reasons?: string[];
  optimality_note: string;
  high_congestion_segments?: Array<{
    name: string;
    congestion: number;
    time_min: number;
    segment_count: number;
  }>;
  alternative_comparison?: {
    algorithm: string;
    label: string;
    same_path: boolean;
    summary: string;
    total_cost: number;
    total_distance_km: number;
    total_time_min: number;
    expanded_nodes: number;
    high_congestion_segments: number;
  } | null;
}

export interface RouteSegment {
  from: string;
  to: string;
  name: string;
  road_type: string;
  distance_km: number;
  time_min: number;
  congestion: number;
  risk: number;
  cost: number;
  oneway: boolean;
  geometry: number[][];
}

export interface SearchPayload {
  request: {
    start: Landmark;
    goal: Landmark;
    algorithm: string;
    criterion: string;
    traffic_profile: string;
    weights: Record<string, number>;
  };
  result: SearchResult;
  route_geojson: GeoJsonFeature;
  route_segments: RouteSegment[];
  alternative: {
    algorithm: string;
    result: SearchResult;
    route_geojson: GeoJsonFeature;
  } | null;
  explanation: Explanation;
}

export interface MultiMethodResult {
  method: string;
  success: boolean;
  visiting_order: string[];
  full_path: string[];
  total_cost: number | null;
  total_distance_km: number | null;
  total_time_min: number | null;
  runtime_ms: number;
  optimality: string;
  comparison_gap_percent: number | null;
  message: string;
}

export interface MultiPayload {
  request: {
    start: Landmark;
    waypoints: Landmark[];
    end: Landmark | null;
    method: string;
    return_to_start: boolean;
    criterion: string;
    traffic_profile: string;
    weights: Record<string, number>;
  };
  result: MultiMethodResult;
  visiting_landmarks: Landmark[];
  route_geojson: GeoJsonFeature;
  route_segments: RouteSegment[];
  comparison: {
    nearest_neighbor: MultiMethodResult;
    exact_bruteforce: MultiMethodResult;
  } | null;
  explanation: {
    headline: string;
    optimality_note: string;
    duplicate_policy: string;
  };
}

export interface GeoJsonFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: number[][];
  };
}

export interface Bootstrap {
  landmarks: Landmark[];
  algorithms: Record<string, AlgorithmMeta>;
  cost_presets: Record<string, Record<string, number>>;
  traffic_profiles: Record<string, string>;
  network_summary: Record<string, number | string | unknown[]>;
  node_coordinates: Record<string, [number, number]>;
  boundary: Record<string, unknown>;
}

export interface ComparePayload {
  request: SearchPayload["request"];
  algorithms: SearchPayload[];
  summary: {
    headline: string;
    leaders: Record<
      string,
      { algorithms: string[]; value: number }
    >;
    observations: string[];
  };
}

export interface SearchRequest {
  start: string;
  goal: string;
  algorithm: string;
  criterion: string;
  traffic_profile: string;
  capture_trace?: boolean;
}
