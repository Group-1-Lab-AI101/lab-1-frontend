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
  SearchStep,
} from "../types";

interface MapViewProps {
  bootstrap: Bootstrap;
  network: Record<string, unknown> | null;
  route: GeoJsonFeature | null;
  currentStep: SearchStep | null;
  selectedLandmarks: Landmark[];
  showBaseMap?: boolean;
}

export const routeRenderKey = (route: GeoJsonFeature) =>
  JSON.stringify(route.geometry);

function FitRoute({ route, selected }: { route: GeoJsonFeature | null; selected: Landmark[] }) {
  const map = useMap();
  useEffect(() => {
    const routeCoordinates = route?.geometry.coordinates ?? [];
    const points = routeCoordinates.length
      ? routeCoordinates.map(([longitude, latitude]) => [latitude, longitude] as [number, number])
      : selected.map((landmark) => [landmark.latitude, landmark.longitude] as [number, number]);
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
}: MapViewProps) {
  const selectedIds = new Set(selectedLandmarks.map((item) => item.id));
  const visited = Array.from(new Set(currentStep?.visited ?? [])).slice(-120);
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
          style={{ color: "#7d8982", weight: 1.2, opacity: 0.48 }}
        />
      )}
      {selectedLandmarks.map((landmark) => {
        const snapped = coordinates[landmark.snapped_node];
        return snapped && landmark.snapped_distance_m > 1 ? (
          <Polyline
            key={`access-${landmark.id}`}
            positions={[
              [landmark.latitude, landmark.longitude],
              snapped,
            ]}
            pathOptions={{
              color: "#1f6b49",
              dashArray: "4 5",
              opacity: 0.72,
              weight: 2,
            }}
          />
        ) : null;
      })}
      {route && route.geometry.coordinates.length > 0 && (
        <GeoJSON
          key={routeRenderKey(route)}
          data={route as never}
          style={{ color: "#d43d2f", weight: 5, opacity: 0.95 }}
        />
      )}

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
            radius={active ? 7 : 4}
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
              {landmark.category}
            </Tooltip>
          </CircleMarker>
        );
      })}
      <FitRoute route={route} selected={selectedLandmarks} />
    </MapContainer>
  );
}
