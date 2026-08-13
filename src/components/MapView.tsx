import { useEffect } from "react";
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type {
  Bootstrap,
  GeoJsonFeature,
  Landmark,
  RouteSegment,
  SearchStep,
} from "../types";

interface MapViewProps {
  bootstrap: Bootstrap;
  network: Record<string, unknown> | null;
  route: GeoJsonFeature | null;
  currentStep: SearchStep | null;
  selectedLandmarks: Landmark[];
  showBaseMap?: boolean;
  routeSegments?: RouteSegment[];
  colorRouteByConditions?: boolean;
}

export const routeRenderKey = (route: GeoJsonFeature) =>
  JSON.stringify(route.geometry);

export const MINIMAL_BASEMAP_URL =
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const routeConditionSeverity = (segment: Pick<RouteSegment, "congestion" | "risk">) => {
  const congestion = clamp01((segment.congestion - 1) / 4);
  const risk = clamp01(segment.risk / 2.2);
  return 0.75 * congestion + 0.25 * risk;
};

export const routeConditionColor = (segment: Pick<RouteSegment, "congestion" | "risk">) => {
  const hue = 120 * (1 - routeConditionSeverity(segment));
  return `hsl(${hue.toFixed(1)} 72% 42%)`;
};

function FitRoute({ route, selected }: { route: GeoJsonFeature | null; selected: Landmark[] }) {
  const map = useMap();
  useEffect(() => {
    const routeCoordinates = route?.geometry.coordinates ?? [];
    const routePoints = routeCoordinates.map(
      ([longitude, latitude]) => [latitude, longitude] as [number, number],
    );
    const landmarkPoints = selected.flatMap((landmark) => [
      [landmark.latitude, landmark.longitude] as [number, number],
      [landmark.routing_latitude, landmark.routing_longitude] as [number, number],
    ]);
    const points = [...routePoints, ...landmarkPoints];
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
    else if (points.length === 1) map.setView(points[0], 15);
  }, [map, route, selected]);
  return null;
}

export default function MapView({
  bootstrap,
  network,
  route,
  currentStep,
  selectedLandmarks,
  showBaseMap = true,
  routeSegments = [],
  colorRouteByConditions = false,
}: MapViewProps) {
  const selectedIds = new Set(selectedLandmarks.map((item) => item.id));
  const visited = Array.from(new Set(currentStep?.visited ?? []));
  const frontier = Array.from(
    new Map(
      (currentStep?.frontier ?? []).map((entry) => [entry.node, entry]),
    ).values(),
  ).slice(0, 80);
  const coordinates = bootstrap.node_coordinates;

  return (
    <MapContainer
      className="route-map"
      center={[10.7798, 106.699]}
      zoom={14}
      minZoom={12}
      preferCanvas
      zoomControl
    >
      {showBaseMap && (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={MINIMAL_BASEMAP_URL}
          subdomains="abcd"
          maxZoom={20}
          opacity={0.88}
        />
      )}
      {bootstrap.boundary && (
        <GeoJSON
          key="boundary-layer"
          data={bootstrap.boundary as never}
          style={{ color: "#1f6b49", weight: 1.5, dashArray: "6 6", opacity: 0.6, fillOpacity: 0.04 }}
        />
      )}
      {network && (
        <GeoJSON
          data={network as never}
          style={{ color: "#7d8982", weight: 0.9, opacity: 0.3 }}
        />
      )}
      {selectedLandmarks.flatMap((landmark) => {
        const snapped = coordinates[landmark.snapped_node];
        const center: [number, number] = [landmark.latitude, landmark.longitude];
        const access: [number, number] = [
          landmark.routing_latitude,
          landmark.routing_longitude,
        ];
        const hasDistinctAccess =
          Math.abs(center[0] - access[0]) > 0.000001
          || Math.abs(center[1] - access[1]) > 0.000001;
        const lines = [];
        if (hasDistinctAccess) {
          lines.push(
            <Polyline
              key={`venue-access-${landmark.id}`}
              positions={[center, access]}
              pathOptions={{
                color: "#1f6b49",
                dashArray: "4 5",
                opacity: 0.72,
                weight: 2,
              }}
            />,
          );
        }
        if (snapped && landmark.snapped_distance_m > 1) {
          lines.push(
            <Polyline
              key={`road-access-${landmark.id}`}
              positions={[access, snapped]}
              pathOptions={{
                color: "#b97810",
                dashArray: "2 4",
                opacity: 0.82,
                weight: 2,
              }}
            />,
          );
        }
        return lines;
      })}
      {selectedLandmarks.map((landmark) => {
        const hasDistinctAccess =
          Math.abs(landmark.latitude - landmark.routing_latitude) > 0.000001
          || Math.abs(landmark.longitude - landmark.routing_longitude) > 0.000001;
        return hasDistinctAccess ? (
          <CircleMarker
            key={`routing-access-${landmark.id}`}
            center={[landmark.routing_latitude, landmark.routing_longitude]}
            radius={4.5}
            pathOptions={{
              color: "#7b4d08",
              fillColor: "#f0aa2f",
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip direction="top">
              <strong>{landmark.access_label}</strong>
              <br />
              {landmark.access_road}
            </Tooltip>
          </CircleMarker>
        ) : null;
      })}
      {route && route.geometry.coordinates.length > 0 && (
        <GeoJSON
          key={routeRenderKey(route)}
          data={route as never}
          style={{
            color: colorRouteByConditions ? "#aab3ae" : "#d43d2f",
            weight: colorRouteByConditions ? 6 : 5,
            opacity: colorRouteByConditions ? 0.62 : 0.95,
          }}
        />
      )}
      {colorRouteByConditions && routeSegments.map((segment, index) => {
        if (segment.geometry.length < 2) return null;
        const positions = segment.geometry.map(
          ([longitude, latitude]) => [latitude, longitude] as [number, number],
        );
        return (
          <Polyline
            key={`condition-route-${segment.from}-${segment.to}-${index}`}
            positions={positions}
            pathOptions={{
              color: routeConditionColor(segment),
              weight: 5,
              opacity: 0.96,
              lineCap: "round",
              lineJoin: "round",
            }}
          >
            <Tooltip sticky>
              <strong>{segment.name}</strong>
              <br />
              Congestion: {segment.congestion.toFixed(1)} / 5 · Risk: {segment.risk.toFixed(1)}
            </Tooltip>
          </Polyline>
        );
      })}

      {visited.map((node) => {
        const position = coordinates[node];
        return position ? (
          <CircleMarker
            key={`visited-${node}`}
            center={position}
            radius={2.4}
            pathOptions={{ color: "#1f67b1", fillColor: "#3f8dd8", fillOpacity: 0.72, weight: 1 }}
          />
        ) : null;
      })}
      {frontier.map(({ node }) => {
        const position = coordinates[node];
        return position ? (
          <CircleMarker
            key={`frontier-${node}`}
            center={position}
            radius={3}
            pathOptions={{ color: "#b97810", fillColor: "#f0aa2f", fillOpacity: 0.8, weight: 1 }}
          />
        ) : null;
      })}
      {currentStep?.current_node && coordinates[currentStep.current_node] && (
        <CircleMarker
          center={coordinates[currentStep.current_node]}
          radius={6}
          pathOptions={{ color: "#8f211a", fillColor: "#e24a3b", fillOpacity: 1, weight: 2 }}
        >
          <Tooltip permanent direction="top">Current</Tooltip>
        </CircleMarker>
      )}

      {bootstrap.landmarks.map((landmark) => {
        const active = selectedIds.has(landmark.id);
        return (
          <CircleMarker
            key={landmark.id}
            center={[landmark.latitude, landmark.longitude]}
            radius={active ? 6 : 3.5}
            pathOptions={{
              color: active ? "#123b2b" : "#ffffff",
              fillColor: active ? "#1f7a50" : "#293b33",
              fillOpacity: active ? 1 : 0.75,
              weight: active ? 2 : 1,
            }}
          >
            <Tooltip direction="top">
              <strong>{landmark.name}</strong>
              <br />
              {landmark.category} · location center
            </Tooltip>
          </CircleMarker>
        );
      })}
      <FitRoute route={route} selected={selectedLandmarks} />
    </MapContainer>
  );
}
